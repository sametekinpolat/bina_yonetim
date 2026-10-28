import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { flats, monthlyInvoices, flatRelationships, people, billingPeriods } from "@/lib/db/schema";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import Decimal from "decimal.js";
import { renderDebtPdf, safeReportSlug, type DebtReportRow } from "@/lib/reports/debt-pdf";

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStoredFiles(files: { name: string; data: Buffer }[]) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const checksum = crc32(file.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(33, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(file.data.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, file.data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(33, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(file.data.length, 20);
    central.writeUInt32LE(file.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + file.data.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [flatRows, residentRows, extraRows] = await Promise.all([
    db.select({
      flatId: flats.id,
      flatNumber: flats.flatNumber,
      totalDue: sql<string>`COALESCE(SUM(CASE WHEN ${billingPeriods.status} != 'Taslak' AND ${billingPeriods.periodType} = 'Aylık' THEN ${monthlyInvoices.totalDue}::numeric ELSE 0 END), 0)`,
      totalPaid: sql<string>`COALESCE(SUM(CASE WHEN ${billingPeriods.status} != 'Taslak' AND ${billingPeriods.periodType} = 'Aylık' THEN ${monthlyInvoices.amountPaid}::numeric ELSE 0 END), 0)`,
    }).from(flats)
      .leftJoin(monthlyInvoices, eq(monthlyInvoices.flatId, flats.id))
      .leftJoin(billingPeriods, eq(billingPeriods.id, monthlyInvoices.periodId))
      .groupBy(flats.id, flats.flatNumber)
      .orderBy(flats.flatNumber),
    db.select({
      flatId: flatRelationships.flatId,
      firstName: people.firstName,
      lastName: people.lastName,
    }).from(flatRelationships)
      .innerJoin(people, eq(people.id, flatRelationships.personId))
      .where(isNull(flatRelationships.moveOutDate))
      .orderBy(flatRelationships.flatId),
    db.select({
      periodId: billingPeriods.id,
      periodName: billingPeriods.periodName,
      flatId: flats.id,
      flatNumber: flats.flatNumber,
      totalDue: monthlyInvoices.totalDue,
      amountPaid: monthlyInvoices.amountPaid,
    }).from(monthlyInvoices)
      .innerJoin(billingPeriods, eq(billingPeriods.id, monthlyInvoices.periodId))
      .innerJoin(flats, eq(flats.id, monthlyInvoices.flatId))
      .where(and(eq(billingPeriods.periodType, "Ek Dönem"), ne(billingPeriods.status, "Taslak")))
      .orderBy(billingPeriods.periodYear, billingPeriods.periodMonth, flats.flatNumber),
  ]);

  const residents = new Map<number, string>();
  for (const resident of residentRows) {
    if (!residents.has(resident.flatId)) residents.set(resident.flatId, `${resident.firstName} ${resident.lastName}`);
  }

  const dateStr = new Date().toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const files: { name: string; data: Buffer }[] = [];
  const generalRows: DebtReportRow[] = flatRows.map((flat) => ({
    flatNumber: flat.flatNumber,
    residentName: residents.get(flat.flatId) ?? "-",
    net: new Decimal(flat.totalDue).sub(flat.totalPaid),
  }));
  const generalPdf = await renderDebtPdf(`${dateStr} İtibariyle Güncel Aylık Aidat Borç Durumu`, generalRows);
  files.push({ name: `genel-aylik-aidat-borclari-${safeReportSlug(dateStr)}.pdf`, data: generalPdf });

  const periodGroups = new Map<number, { name: string; rows: DebtReportRow[] }>();
  for (const row of extraRows) {
    const group = periodGroups.get(row.periodId) ?? { name: row.periodName, rows: [] };
    group.rows.push({
      flatNumber: row.flatNumber,
      residentName: residents.get(row.flatId) ?? "-",
      net: new Decimal(row.totalDue).sub(row.amountPaid ?? "0"),
    });
    periodGroups.set(row.periodId, group);
  }

  for (const group of periodGroups.values()) {
    if (!group.rows.some((row) => row.net.greaterThan(0))) continue;
    const report = await renderDebtPdf(`${group.name} — Ek Dönem Borç Durumu`, group.rows, true);
    files.push({ name: `ek-donem-${safeReportSlug(group.name)}.pdf`, data: report });
  }

  const archive = zipStoredFiles(files);
  const dateSlug = new Date().toISOString().slice(0, 10);
  return new NextResponse(archive as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="borc-raporlari-${dateSlug}.zip"`,
    },
  });
}
