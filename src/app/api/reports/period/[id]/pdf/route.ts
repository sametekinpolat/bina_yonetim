import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  billingPeriods,
  monthlyInvoices,
  flats,
  periodPlanExpenses,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import PDFDocument from "pdfkit";

// ─── colour palette (matches QuestPDF output) ────────────────────────────────
const BLUE_HEADER = "#BBDEFB"; // Blue.Lighten3
const BLUE_TITLE = "#1565C0"; // Blue.Darken2
const GREEN_HEADER = "#C8E6C9"; // Green.Lighten3
const GREEN_TITLE = "#2E7D32"; // Green.Darken2
const GREY_STRIPE = "#F5F5F5"; // Grey.Lighten4
const GREY_TOTAL = "#E0E0E0"; // Grey.Lighten3
const GREY_MED = "#9E9E9E"; // Grey.Medium

// ─── helpers ─────────────────────────────────────────────────────────────────
function fmtMoney(n: number): string {
  return "₺" + n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

// Draw a filled rectangle
function fillRect(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, hex: string) {
  doc.save().rect(x, y, w, h).fill(hex).restore();
}

// Draw a bottom border line for a table row
function rowBorder(doc: PDFKit.PDFDocument, x: number, y: number, w: number, color = "#E0E0E0") {
  doc.save().moveTo(x, y).lineTo(x + w, y).strokeColor(color).lineWidth(0.5).stroke().restore();
}

// Render a single table cell (text only, no background — background drawn separately)
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
  const pad = 4;
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

// ─── route handler ────────────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const periodId = parseInt(id);
  if (isNaN(periodId)) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  // ── fetch data ───────────────────────────────────────────────────────────
  const [period] = await db
    .select()
    .from(billingPeriods)
    .where(eq(billingPeriods.id, periodId))
    .limit(1);

  if (!period) return NextResponse.json({ error: "Period not found" }, { status: 404 });

  const [expenses, invoiceRows] = await Promise.all([
    db
      .select()
      .from(periodPlanExpenses)
      .where(eq(periodPlanExpenses.periodId, periodId))
      .orderBy(periodPlanExpenses.sortOrder, periodPlanExpenses.id),

    db
      .select({
        id: monthlyInvoices.id,
        flatNumber: flats.flatNumber,
        gasFee: monthlyInvoices.gasFee,
        waterFee: monthlyInvoices.waterFee,
        otherFee: monthlyInvoices.otherFee,
        totalDue: monthlyInvoices.totalDue,
      })
      .from(monthlyInvoices)
      .innerJoin(flats, eq(flats.id, monthlyInvoices.flatId))
      .where(eq(monthlyInvoices.periodId, periodId))
      .orderBy(flats.flatNumber),
  ]);

  // ── build PDF ─────────────────────────────────────────────────────────────
  // A4 Landscape: 841.89 × 595.28 pt
  const PAGE_W = 841.89;
  const PAGE_H = 595.28;
  const MARGIN = 28.35; // ~1 cm
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const ROW_H = 18;
  const HDR_H = 20;

  // Left table width = 1/3 of content, right = 2/3, gap 20
  const GAP = 20;
  const LEFT_W = Math.floor((CONTENT_W - GAP) / 3);
  const RIGHT_W = CONTENT_W - GAP - LEFT_W;

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

  // ─── helper: render a full page of content at yStart ──────────────────────
  function drawPage(doc: PDFKit.PDFDocument, pageNum: number, _totalPages: number) {
    const yContent = MARGIN + 60; // after header

    // ── HEADER ──
    doc.font("Roboto-Bold").fontSize(18).fillColor("#000000")
      .text(`Apartman Aidat Tablosu - ${period.periodName}`, MARGIN, MARGIN, { width: CONTENT_W });

    const nowStr = new Date().toLocaleString("tr-TR", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
    doc.font("Roboto").fontSize(9).fillColor(GREY_MED)
      .text(`Oluşturulma: ${nowStr}`, MARGIN, MARGIN + 22, { width: CONTENT_W });

    // ── FOOTER ──
    doc.font("Roboto").fontSize(9).fillColor(GREY_MED)
      .text(`Sayfa ${pageNum}`, MARGIN, PAGE_H - MARGIN - 12, { width: CONTENT_W, align: "center" });

    // ── LEFT TABLE: Expenses ──────────────────────────────────────────────────
    const lx = MARGIN;
    let ly = yContent;

    // Section title
    doc.font("Roboto-Bold").fontSize(14).fillColor(BLUE_TITLE)
      .text("Giderler", lx, ly);
    ly += 20;

    // Expense columns: Description (relative 3), Amount (relative 1)
    const descW = Math.floor(LEFT_W * 0.75);
    const amtW = LEFT_W - descW;

    // Header row
    fillRect(doc, lx, ly, LEFT_W, HDR_H, BLUE_HEADER);
    cellText(doc, "Açıklama", lx, ly, descW, HDR_H, { bold: true });
    cellText(doc, "Tutar", lx + descW, ly, amtW, HDR_H, { bold: true, align: "right" });
    ly += HDR_H;

    // Data rows
    const expList = expenses.slice();
    for (let i = 0; i < expList.length; i++) {
      const exp = expList[i];
      const bg = i % 2 === 1 ? GREY_STRIPE : "#FFFFFF";
      fillRect(doc, lx, ly, LEFT_W, ROW_H, bg);
      cellText(doc, exp.description, lx, ly, descW, ROW_H, { fontSize: 9 });
      cellText(doc, fmtMoney(Number(exp.amount)), lx + descW, ly, amtW, ROW_H, { fontSize: 9, align: "right" });
      rowBorder(doc, lx, ly + ROW_H, LEFT_W);
      ly += ROW_H;
    }

    // Total row
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
    fillRect(doc, lx, ly, LEFT_W, ROW_H, GREY_TOTAL);
    cellText(doc, "TOPLAM", lx, ly, descW, ROW_H, { bold: true, fontSize: 9 });
    cellText(doc, fmtMoney(totalExpenses), lx + descW, ly, amtW, ROW_H, { bold: true, fontSize: 9, align: "right" });
    ly += ROW_H + 10;

    // Summary info (Sıcak Su, Doğalgaz, Düşük Kullanım)
    const summaryLines = [
      `Sıcak Su: ${fmtMoney(Number(period.distributedWater ?? 0))}`,
      `Doğalgaz: ${fmtMoney(Number(period.distributedGas ?? 0))}`,
      `Düşük Kullanım: %${Number(period.lowDiscountPercent ?? 0).toFixed(0)}`,
    ];
    for (const line of summaryLines) {
      doc.font("Roboto").fontSize(9).fillColor("#000000")
        .text(line, lx, ly, { width: LEFT_W });
      ly += 14;
    }

    // ── RIGHT TABLE: Payment Details ─────────────────────────────────────────
    const rx = MARGIN + LEFT_W + GAP;
    let ry = yContent;

    // Section title
    doc.font("Roboto-Bold").fontSize(14).fillColor(GREEN_TITLE)
      .text("Daire Ödemeleri", rx, ry);
    ry += 20;

    // Columns: Daire (50), Su, Gaz, Aidat, Toplam (equal remainder)
    const daireW = 50;
    const moneyColW = Math.floor((RIGHT_W - daireW) / 4);
    // Adjust last col to fill any rounding gap
    const lastColW = RIGHT_W - daireW - moneyColW * 3;

    const colXs = [
      rx,
      rx + daireW,
      rx + daireW + moneyColW,
      rx + daireW + moneyColW * 2,
      rx + daireW + moneyColW * 3,
    ];
    const colWs = [daireW, moneyColW, moneyColW, moneyColW, lastColW];

    // Header row
    fillRect(doc, rx, ry, RIGHT_W, HDR_H, GREEN_HEADER);
    const headers = ["Daire", "Su", "Gaz", "Aidat", "Toplam"];
    const headerAligns: ("left" | "right")[] = ["left", "right", "right", "right", "right"];
    for (let c = 0; c < 5; c++) {
      cellText(doc, headers[c], colXs[c], ry, colWs[c], HDR_H, { bold: true, align: headerAligns[c] });
    }
    ry += HDR_H;

    // Data rows — sorted by flat number (already ordered by DB)
    const details = invoiceRows;

    let totalSu = 0, totalGaz = 0, totalAidat = 0, grandTotal = 0;

    for (let i = 0; i < details.length; i++) {
      const d = details[i];
      const su = Number(d.waterFee ?? 0);
      const gaz = Number(d.gasFee ?? 0);
      const aidat = Number(d.otherFee ?? 0);
      const toplam = Number(d.totalDue);
      totalSu += su; totalGaz += gaz; totalAidat += aidat; grandTotal += toplam;

      const bg = i % 2 === 1 ? GREY_STRIPE : "#FFFFFF";
      fillRect(doc, rx, ry, RIGHT_W, ROW_H, bg);

      const rowVals = [d.flatNumber.toString(), fmtMoney(su), fmtMoney(gaz), fmtMoney(aidat), fmtMoney(toplam)];
      const rowAligns: ("left" | "right")[] = ["left", "right", "right", "right", "right"];
      for (let c = 0; c < 5; c++) {
        const isBold = c === 4; // Toplam bold
        cellText(doc, rowVals[c], colXs[c], ry, colWs[c], ROW_H, { fontSize: 9, align: rowAligns[c], bold: isBold });
      }
      rowBorder(doc, rx, ry + ROW_H, RIGHT_W);
      ry += ROW_H;
    }

    // Total row
    fillRect(doc, rx, ry, RIGHT_W, ROW_H, GREY_TOTAL);
    cellText(doc, "TOPLAM", colXs[0], ry, colWs[0], ROW_H, { bold: true, fontSize: 9 });
    cellText(doc, fmtMoney(totalSu), colXs[1], ry, colWs[1], ROW_H, { bold: true, fontSize: 9, align: "right" });
    cellText(doc, fmtMoney(totalGaz), colXs[2], ry, colWs[2], ROW_H, { bold: true, fontSize: 9, align: "right" });
    cellText(doc, fmtMoney(totalAidat), colXs[3], ry, colWs[3], ROW_H, { bold: true, fontSize: 9, align: "right" });
    cellText(doc, fmtMoney(grandTotal), colXs[4], ry, colWs[4], ROW_H, { bold: true, fontSize: 9, align: "right" });
  }

  // Render page 1 (single page — same data as .NET for normal apartment counts)
  drawPage(doc, 1, 1);

  doc.end();
  const pdfBuffer = await done;

  const slug = period.periodName.toLowerCase().replace(/\s+/g, "-");
  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="aidat-${slug}.pdf"`,
    },
  });
}
