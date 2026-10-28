import fs from "node:fs";
import path from "node:path";
import Decimal from "decimal.js";
import PDFDocument from "pdfkit";

export type DebtReportRow = {
  flatNumber: number;
  residentName: string;
  net: Decimal;
};

const BLUE_HEADER = "#BBDEFB";
const BLUE_TITLE = "#1565C0";
const BLUE_CREDIT = "#1E88E5";
const RED_DEBT = "#E53935";
const RED_DEBT_DARK = "#C62828";
const GREEN_NONE = "#43A047";
const GREEN_NET = "#2E7D32";
const GREY_STRIPE = "#F5F5F5";
const GREY_TOTAL = "#EEEEEE";
const GREY_MED = "#9E9E9E";

function fmtMoney(value: number | Decimal) {
  return "₺" + Number(value).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function renderDebtPdf(title: string, inputRows: DebtReportRow[], onlyPositiveDebt = false) {
  const rows = [...inputRows].sort((a, b) => a.flatNumber - b.flatNumber);
  const total = rows.reduce(
    (sum, row) => sum.add(onlyPositiveDebt ? Decimal.max(row.net, 0) : row.net),
    new Decimal(0),
  );
  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const MARGIN = 28.35;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const ROW_H = 20;
  const HDR_H = 22;
  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ autoFirstPage: false });
  doc.registerFont("Roboto", fs.readFileSync(path.join(process.cwd(), "src/assets/fonts/Roboto-Regular.ttf")));
  doc.registerFont("Roboto-Bold", fs.readFileSync(path.join(process.cwd(), "src/assets/fonts/Roboto-Bold.ttf")));
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  const now = new Date();
  const dateStr = now.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeStr = now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  let y = MARGIN;

  const fillRect = (x: number, yPos: number, w: number, h: number, color: string) => {
    doc.save().rect(x, yPos, w, h).fill(color).restore();
  };
  const drawCell = (text: string, x: number, yPos: number, w: number, h: number, opts: {
    align?: "left" | "right" | "center"; bold?: boolean; fontSize?: number; color?: string;
  } = {}) => {
    const { align = "left", bold = false, fontSize = 10, color = "#000000" } = opts;
    doc.save().font(bold ? "Roboto-Bold" : "Roboto").fontSize(fontSize).fillColor(color)
      .text(text, x + 5, yPos + (h - fontSize) / 2, { width: w - 10, align })
      .restore();
  };
  const border = (x: number, yPos: number, w: number) => {
    doc.save().moveTo(x, yPos).lineTo(x + w, yPos).strokeColor("#E0E0E0").lineWidth(0.5).stroke().restore();
  };

  doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 });
  doc.font("Roboto-Bold").fontSize(16).fillColor("#000000").text(title, MARGIN, y, { width: CONTENT_W });
  y += 24;
  doc.font("Roboto").fontSize(9).fillColor(GREY_MED).text(`Oluşturulma: ${dateStr} ${timeStr}`, MARGIN, y);
  y += 30;

  border(MARGIN, y, CONTENT_W);
  border(MARGIN, y + 60, CONTENT_W);
  doc.save().moveTo(MARGIN, y).lineTo(MARGIN, y + 60).strokeColor("#E0E0E0").lineWidth(0.5).stroke().restore();
  doc.save().moveTo(PAGE_W - MARGIN, y).lineTo(PAGE_W - MARGIN, y + 60).strokeColor("#E0E0E0").lineWidth(0.5).stroke().restore();
  doc.font("Roboto").fontSize(9).fillColor(GREY_MED).text("Net Bakiye", MARGIN, y + 10, { width: CONTENT_W, align: "center" });
  const displayAmount = total.greaterThan(0) ? `-${fmtMoney(total)}` : fmtMoney(total.abs());
  const displayColor = total.greaterThan(0) ? RED_DEBT_DARK : GREEN_NET;
  doc.font("Roboto-Bold").fontSize(18).fillColor(displayColor).text(displayAmount, MARGIN, y + 26, { width: CONTENT_W, align: "center" });
  y += 80;

  doc.font("Roboto-Bold").fontSize(14).fillColor(BLUE_TITLE).text("Daire Borçları", MARGIN, y);
  y += 20;
  const daireW = 50;
  const relUnit = Math.floor((CONTENT_W - daireW) / 4);
  const sakinW = relUnit * 2;
  const bakiyeW = relUnit;
  const durumW = CONTENT_W - daireW - sakinW - bakiyeW;
  const xs = [MARGIN, MARGIN + daireW, MARGIN + daireW + sakinW, MARGIN + daireW + sakinW + bakiyeW];
  const ws = [daireW, sakinW, bakiyeW, durumW];
  fillRect(MARGIN, y, CONTENT_W, HDR_H, BLUE_HEADER);
  drawCell("Daire", xs[0], y, ws[0], HDR_H, { bold: true });
  drawCell("Sakin", xs[1], y, ws[1], HDR_H, { bold: true });
  drawCell("Bakiye", xs[2], y, ws[2], HDR_H, { bold: true, align: "right" });
  drawCell("Durum", xs[3], y, ws[3], HDR_H, { bold: true, align: "center" });
  y += HDR_H;

  rows.forEach((row, i) => {
    if (y + ROW_H > PAGE_H - MARGIN - 30) {
      doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 });
      y = MARGIN;
    }
    fillRect(MARGIN, y, CONTENT_W, ROW_H, i % 2 ? GREY_STRIPE : "#FFFFFF");
    border(MARGIN, y + ROW_H, CONTENT_W);
    const debt = row.net.greaterThan(0);
    const credit = row.net.lessThan(0);
    drawCell(String(row.flatNumber), xs[0], y, ws[0], ROW_H);
    drawCell(row.residentName, xs[1], y, ws[1], ROW_H);
    drawCell(fmtMoney(row.net.abs()), xs[2], y, ws[2], ROW_H, {
      align: "right", bold: debt || credit, color: debt ? RED_DEBT_DARK : credit ? BLUE_CREDIT : GREEN_NET,
    });
    drawCell(debt ? "Borçlu" : credit ? "Kredi" : "Borç Yok", xs[3], y, ws[3], ROW_H, {
      align: "center", fontSize: 9, color: debt ? RED_DEBT : credit ? BLUE_CREDIT : GREEN_NONE,
    });
    y += ROW_H;
  });

  if (y + ROW_H > PAGE_H - MARGIN - 30) {
    doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 });
    y = MARGIN;
  }
  fillRect(MARGIN, y, CONTENT_W, ROW_H + 4, GREY_TOTAL);
  drawCell("TOPLAM NET BAKİYE", xs[0], y, ws[0] + ws[1], ROW_H + 4, { bold: true });
  drawCell(fmtMoney(total.abs()), xs[2], y, ws[2], ROW_H + 4, { bold: true, align: "right", color: displayColor });
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.font("Roboto").fontSize(9).fillColor(GREY_MED)
      .text(`Sayfa ${i + 1} / ${pages.count}`, MARGIN, PAGE_H - MARGIN - 12, { width: CONTENT_W, align: "center" });
  }
  doc.end();
  return done;
}

export function safeReportSlug(value: string) {
  return value.toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i").replaceAll("ğ", "g").replaceAll("ü", "u")
    .replaceAll("ş", "s").replaceAll("ö", "o").replaceAll("ç", "c")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "borc-raporu";
}
