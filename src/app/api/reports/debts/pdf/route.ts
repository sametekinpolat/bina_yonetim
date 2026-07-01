import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { flats, monthlyInvoices, flatRelationships, people, billingPeriods } from "@/lib/db/schema";
import { eq, sql, isNull } from "drizzle-orm";
import Decimal from "decimal.js";
import PDFDocument from "pdfkit";

// ─── colour palette ─────────────────────────────────────────────────────────
const BLUE_HEADER = "#BBDEFB"; // Blue.Lighten3
const BLUE_TITLE = "#1565C0";  // Blue.Darken2
const BLUE_CREDIT = "#1E88E5"; // Blue.Darken1
const RED_DEBT = "#E53935";    // Red.Darken1
const RED_DEBT_DARK = "#C62828"; // Red.Darken2
const GREEN_NONE = "#43A047";  // Green.Darken1
const GREEN_NET = "#2E7D32";   // Green.Darken2
const GREY_STRIPE = "#F5F5F5"; // Grey.Lighten4
const GREY_TOTAL = "#EEEEEE";  // Grey.Lighten3
const GREY_MED = "#9E9E9E";    // Grey.Medium

// ─── helpers ─────────────────────────────────────────────────────────────────
function fmtMoney(n: number | Decimal): string {
  return "₺" + Number(n).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fillRect(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, hex: string) {
  doc.save().rect(x, y, w, h).fill(hex).restore();
}

function rowBorder(doc: PDFKit.PDFDocument, x: number, y: number, w: number, color = "#E0E0E0") {
  doc.save().moveTo(x, y).lineTo(x + w, y).strokeColor(color).lineWidth(0.5).stroke().restore();
}

function cellText(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { align?: "left" | "right" | "center"; bold?: boolean; fontSize?: number; color?: string }
) {
  const { align = "left", bold = false, fontSize = 10, color = "#000000" } = opts;
  const pad = 5;
  doc.save()
    .font(bold ? "Roboto-Bold" : "Roboto")
    .fontSize(fontSize)
    .fillColor(color);

  if (align === "right") {
    doc.text(text, x + pad, y + (h - fontSize) / 2, { width: w - pad * 2, align: "right" });
  } else if (align === "center") {
    doc.text(text, x + pad, y + (h - fontSize) / 2, { width: w - pad * 2, align: "center" });
  } else {
    doc.text(text, x + pad, y + (h - fontSize) / 2, { width: w - pad * 2, align: "left" });
  }
  doc.restore();
}

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── fetch data ───────────────────────────────────────────────────────────
  const [flatRows, residentRows] = await Promise.all([
    db
      .select({
        flatId: flats.id,
        flatNumber: flats.flatNumber,
        totalDue: sql<string>`COALESCE(SUM(CASE WHEN ${billingPeriods.status} != 'Taslak' THEN ${monthlyInvoices.totalDue}::numeric ELSE 0 END), 0)`.as("total_due"),
        totalPaid: sql<string>`COALESCE(SUM(CASE WHEN ${billingPeriods.status} != 'Taslak' THEN ${monthlyInvoices.amountPaid}::numeric ELSE 0 END), 0)`.as("total_paid"),
      })
      .from(flats)
      .leftJoin(monthlyInvoices, eq(monthlyInvoices.flatId, flats.id))
      .leftJoin(billingPeriods, eq(billingPeriods.id, monthlyInvoices.periodId))
      .groupBy(flats.id, flats.flatNumber)
      .orderBy(flats.flatNumber),

    db
      .select({
        flatId: flatRelationships.flatId,
        firstName: people.firstName,
        lastName: people.lastName,
      })
      .from(flatRelationships)
      .innerJoin(people, eq(people.id, flatRelationships.personId))
      .where(isNull(flatRelationships.moveOutDate))
      .orderBy(flatRelationships.flatId),
  ]);

  const residentMap = new Map<number, string>();
  for (const r of residentRows) {
    if (!residentMap.has(r.flatId)) {
      residentMap.set(r.flatId, `${r.firstName} ${r.lastName}`);
    }
  }

  const flatDebts = flatRows.map((f) => {
    const due = new Decimal(f.totalDue);
    const paid = new Decimal(f.totalPaid);
    const net = due.sub(paid); // positive = debt, negative = credit
    return {
      flatNumber: f.flatNumber,
      residentName: residentMap.get(f.flatId) ?? "-",
      net,
    };
  });

  // Sort by apartment number (lowest to highest) as in .NET
  const sortedTenants = [...flatDebts].sort((a, b) => a.flatNumber - b.flatNumber);

  // Total Unpaid Amount
  const totalUnpaidAmount = flatDebts.reduce((a, f) => a.add(f.net), new Decimal(0));

  // ── build PDF ─────────────────────────────────────────────────────────────
  // A4 Portrait: 595.28 × 841.89 pt
  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const MARGIN = 28.35; // 1 cm
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const ROW_H = 20;
  const HDR_H = 22;

  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ autoFirstPage: false });

  const fontRegularPath = path.join(process.cwd(), "src/assets/fonts/Roboto-Regular.ttf");
  const fontBoldPath = path.join(process.cwd(), "src/assets/fonts/Roboto-Bold.ttf");
  
  doc.registerFont("Roboto", fs.readFileSync(fontRegularPath));
  doc.registerFont("Roboto-Bold", fs.readFileSync(fontBoldPath));

  doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 });
  doc.font("Roboto");

  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const now = new Date();
  const dateStr = now.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeStr = now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

  let yContent = MARGIN;

  // ── HEADER ──
  doc.font("Roboto-Bold").fontSize(16).fillColor("#000000")
    .text(`${dateStr} İtibariyle Güncel Borç Durumu`, MARGIN, yContent, { width: CONTENT_W });
  yContent += 22;

  doc.font("Roboto").fontSize(9).fillColor(GREY_MED)
    .text(`Oluşturulma: ${dateStr} ${timeStr}`, MARGIN, yContent, { width: CONTENT_W });
  yContent += 30;

  // ── SUMMARY CARD ──
  // Box for Net Bakiye
  rowBorder(doc, MARGIN, yContent, CONTENT_W, "#E0E0E0");
  rowBorder(doc, MARGIN, yContent + 60, CONTENT_W, "#E0E0E0");
  doc.save().moveTo(MARGIN, yContent).lineTo(MARGIN, yContent + 60).strokeColor("#E0E0E0").lineWidth(0.5).stroke().restore();
  doc.save().moveTo(PAGE_W - MARGIN, yContent).lineTo(PAGE_W - MARGIN, yContent + 60).strokeColor("#E0E0E0").lineWidth(0.5).stroke().restore();

  doc.font("Roboto").fontSize(9).fillColor(GREY_MED)
    .text("Net Bakiye", MARGIN, yContent + 10, { width: CONTENT_W, align: "center" });
  
  const displayAmount = totalUnpaidAmount.greaterThan(0)
    ? `-${fmtMoney(totalUnpaidAmount)}`
    : fmtMoney(totalUnpaidAmount.abs());
  const displayColor = totalUnpaidAmount.greaterThan(0) ? RED_DEBT_DARK : GREEN_NET;

  doc.font("Roboto-Bold").fontSize(18).fillColor(displayColor)
    .text(displayAmount, MARGIN, yContent + 26, { width: CONTENT_W, align: "center" });

  yContent += 80;

  // ── TABLE ──
  doc.font("Roboto-Bold").fontSize(14).fillColor(BLUE_TITLE)
    .text("Daire Borçları", MARGIN, yContent);
  yContent += 20;

  // Columns: Daire (50), Sakin (Relative 2), Bakiye (Relative 1), Durum (Relative 1)
  const daireW = 50;
  const relUnit = Math.floor((CONTENT_W - daireW) / 4);
  const sakinW = relUnit * 2;
  const bakiyeW = relUnit;
  const durumW = CONTENT_W - daireW - sakinW - bakiyeW;

  const colXs = [MARGIN, MARGIN + daireW, MARGIN + daireW + sakinW, MARGIN + daireW + sakinW + bakiyeW];
  const colWs = [daireW, sakinW, bakiyeW, durumW];

  // Header
  fillRect(doc, MARGIN, yContent, CONTENT_W, HDR_H, BLUE_HEADER);
  cellText(doc, "Daire", colXs[0], yContent, colWs[0], HDR_H, { bold: true });
  cellText(doc, "Sakin", colXs[1], yContent, colWs[1], HDR_H, { bold: true });
  cellText(doc, "Bakiye", colXs[2], yContent, colWs[2], HDR_H, { bold: true, align: "right" });
  cellText(doc, "Durum", colXs[3], yContent, colWs[3], HDR_H, { bold: true, align: "center" });
  yContent += HDR_H;

  // Rows
  for (let i = 0; i < sortedTenants.length; i++) {
    const tenant = sortedTenants[i];
    const bg = i % 2 === 1 ? GREY_STRIPE : "#FFFFFF";
    
    // Page break logic
    if (yContent + ROW_H > PAGE_H - MARGIN - 30) {
      doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 });
      yContent = MARGIN;
    }

    fillRect(doc, MARGIN, yContent, CONTENT_W, ROW_H, bg);
    rowBorder(doc, MARGIN, yContent + ROW_H, CONTENT_W);

    let statusText = "Borç Yok";
    let statusColor = GREEN_NONE;
    let bakiyeColor = GREEN_NET;
    let bakiyeBold = false;

    if (tenant.net.greaterThan(0)) {
      statusText = "Borçlu";
      statusColor = RED_DEBT;
      bakiyeColor = RED_DEBT_DARK;
      bakiyeBold = true;
    } else if (tenant.net.lessThan(0)) {
      statusText = "Kredi";
      statusColor = BLUE_CREDIT;
      bakiyeColor = BLUE_CREDIT;
      bakiyeBold = true;
    }

    cellText(doc, tenant.flatNumber.toString(), colXs[0], yContent, colWs[0], ROW_H, { fontSize: 10 });
    cellText(doc, tenant.residentName, colXs[1], yContent, colWs[1], ROW_H, { fontSize: 10 });
    cellText(doc, fmtMoney(tenant.net.abs()), colXs[2], yContent, colWs[2], ROW_H, { 
      fontSize: 10, align: "right", color: bakiyeColor, bold: bakiyeBold 
    });
    cellText(doc, statusText, colXs[3], yContent, colWs[3], ROW_H, { 
      fontSize: 9, align: "center", color: statusColor 
    });

    yContent += ROW_H;
  }

  // Footer Row
  if (yContent + ROW_H > PAGE_H - MARGIN - 30) {
    doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 });
    yContent = MARGIN;
  }
  fillRect(doc, MARGIN, yContent, CONTENT_W, ROW_H + 4, GREY_TOTAL);
  cellText(doc, "TOPLAM NET BAKİYE", colXs[0], yContent, colWs[0] + colWs[1], ROW_H + 4, { bold: true });
  cellText(doc, fmtMoney(totalUnpaidAmount.abs()), colXs[2], yContent, colWs[2], ROW_H + 4, {
    bold: true, align: "right", color: displayColor
  });

  // Footer page numbers
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.font("Roboto").fontSize(9).fillColor(GREY_MED)
      .text(`Sayfa ${i + 1} / ${pages.count}`, MARGIN, PAGE_H - MARGIN - 12, { width: CONTENT_W, align: "center" });
  }

  doc.end();
  const pdfBuffer = await done;

  const slug = `borclar-${dateStr.replace(/\./g, "-")}`;
  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${slug}.pdf"`,
    },
  });
}
