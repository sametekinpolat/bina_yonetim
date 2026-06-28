import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  billingPeriods, monthlyInvoices, flats, flatRelationships, people,
} from "@/lib/db/schema";
import { eq, isNull, sql } from "drizzle-orm";
import ExcelJS from "exceljs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const periodId = parseInt(id);

  const [period] = await db
    .select()
    .from(billingPeriods)
    .where(eq(billingPeriods.id, periodId))
    .limit(1);

  if (!period) return NextResponse.json({ error: "Period not found" }, { status: 404 });

  // Invoices with flat info
  const invoiceRows = await db
    .select({
      invoiceId: monthlyInvoices.id,
      flatId: monthlyInvoices.flatId,
      flatNumber: flats.flatNumber,
      gasFee: monthlyInvoices.gasFee,
      waterFee: monthlyInvoices.waterFee,
      otherFee: monthlyInvoices.otherFee,
      totalDue: monthlyInvoices.totalDue,
      amountPaid: monthlyInvoices.amountPaid,
      status: monthlyInvoices.status,
    })
    .from(monthlyInvoices)
    .innerJoin(flats, eq(flats.id, monthlyInvoices.flatId))
    .where(eq(monthlyInvoices.periodId, periodId))
    .orderBy(flats.flatNumber);

  // Active residents per flat
  const relationships = await db
    .select({
      flatId: flatRelationships.flatId,
      fullName: sql<string>`${people.firstName} || ' ' || ${people.lastName}`.as("full_name"),
    })
    .from(flatRelationships)
    .innerJoin(people, eq(people.id, flatRelationships.personId))
    .where(isNull(flatRelationships.moveOutDate));

  const residentMap = new Map<number, string>();
  for (const rel of relationships) {
    if (!residentMap.has(rel.flatId)) {
      residentMap.set(rel.flatId, rel.fullName);
    }
  }

  // Build workbook
  const wb = new ExcelJS.Workbook();
  wb.creator = "Apartman Yönetim";
  wb.created = new Date();

  const ws = wb.addWorksheet("Invoices");

  // Title
  ws.mergeCells("A1:I1");
  ws.getCell("A1").value = `${period.periodName} — Fatura Özeti`;
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.getCell("A1").alignment = { horizontal: "center" };

  ws.addRow([]);

  // Header row
  const headerRow = ws.addRow([
    "Daire No",
    "Sakin",
    "Gaz (₺)",
    "Su (₺)",
    "Aidat (₺)",
    "Toplam Borç (₺)",
    "Ödenen (₺)",
    "Kalan (₺)",
    "Durum",
  ]);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E7FF" },
    };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF6366F1" } },
    };
    cell.alignment = { horizontal: "center" };
  });

  // Column widths
  ws.columns = [
    { key: "flat", width: 8 },
    { key: "resident", width: 24 },
    { key: "gas", width: 12 },
    { key: "water", width: 12 },
    { key: "dues", width: 12 },
    { key: "totalDue", width: 14 },
    { key: "paid", width: 14 },
    { key: "outstanding", width: 14 },
    { key: "status", width: 12 },
  ];

  let sumGas = 0, sumWater = 0, sumDues = 0, sumDue = 0, sumPaid = 0;

  for (const inv of invoiceRows) {
    const gas = Number(inv.gasFee ?? 0);
    const water = Number(inv.waterFee ?? 0);
    const dues = Number(inv.otherFee ?? 0);
    const due = Number(inv.totalDue);
    const paid = Number(inv.amountPaid ?? 0);
    const outstanding = due - paid;

    sumGas += gas; sumWater += water; sumDues += dues;
    sumDue += due; sumPaid += paid;

    const row = ws.addRow([
      inv.flatNumber,
      residentMap.get(inv.flatId) ?? "—",
      gas,
      water,
      dues,
      due,
      paid,
      outstanding,
      inv.status,
    ]);

    // Color status cell
    const statusCell = row.getCell(9);
    if (inv.status === "Ödendi") statusCell.font = { color: { argb: "FF16A34A" } };
    else if (inv.status === "Ödenmedi") statusCell.font = { color: { argb: "FFDC2626" } };
    else if (inv.status === "Kısmi") statusCell.font = { color: { argb: "FFD97706" } };

    // Format number cells
    for (let i = 3; i <= 8; i++) {
      row.getCell(i).numFmt = '#,##0.00';
      row.getCell(i).alignment = { horizontal: "right" };
    }
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(9).alignment = { horizontal: "center" };
  }

  // Totals row
  ws.addRow([]);
  const totalsRow = ws.addRow([
    "TOPLAM", "",
    sumGas, sumWater, sumDues,
    sumDue, sumPaid, sumDue - sumPaid, "",
  ]);
  totalsRow.eachCell((cell, colNum) => {
    cell.font = { bold: true };
    if (colNum >= 3 && colNum <= 8) {
      cell.numFmt = '#,##0.00';
      cell.alignment = { horizontal: "right" };
    }
  });
  totalsRow.getCell(1).fill = {
    type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" },
  };

  // Generate buffer
  const buffer = await wb.xlsx.writeBuffer();

  const slug = period.periodName.toLowerCase().replace(/\s+/g, "-");
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="invoices-${slug}.xlsx"`,
    },
  });
}
