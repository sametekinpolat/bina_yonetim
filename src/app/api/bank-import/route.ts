import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { bankStatementImports, monthlyInvoices, flats, billingPeriods } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import ExcelJS from "exceljs";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Column indices (0-based) for the bank statement format:
//   Col 0: Tarih       (Date, DD.MM.YYYY)
//   Col 1: Saat        (Time, HH:MM — ignored)
//   Col 2: Tutar       (Amount, Turkish format: 28.075,00 → 28075.00; negative = expense)
//   Col 3: Bakiye      (Balance — ignored)
//   Col 4: Borç/Alacak ("B" = Borç/Expense, "A" = Alacak/Income)
//   Col 5: Açıklama    (Description)
//   Col 6: Fiş/Dekont No (Receipt number)
// ---------------------------------------------------------------------------

const COL_DATE = 1;        // 1-indexed for ExcelJS
const COL_AMOUNT = 3;
const COL_DIRECTION = 5;
const COL_DESCRIPTION = 6;
const COL_RECEIPT = 7;
const HEADER_ROWS = 1;

// ---------------------------------------------------------------------------
// Turkish number format parser: "28.075,00" → 28075.00, "-0,80" → -0.80
// ---------------------------------------------------------------------------
function parseTurkishNumber(raw: unknown): number | null {
  if (typeof raw === "number") return raw;
  if (raw === null || raw === undefined) return null;

  const str = String(raw).trim();
  if (!str) return null;

  // Remove Turkish thousands separator (.) and replace decimal comma (,) with dot
  // But be careful: if there's no comma, it might just be an integer with dot-thousands
  const normalized = str
    .replace(/\./g, "")   // strip all dots (thousands separators)
    .replace(",", ".");   // comma → decimal point

  const n = parseFloat(normalized);
  return isNaN(n) ? null : n;
}

// ---------------------------------------------------------------------------
// Parse a DD.MM.YYYY date string → "YYYY-MM-DD"
// ---------------------------------------------------------------------------
function parseTurkishDate(raw: unknown): string | null {
  if (raw instanceof Date) {
    return raw.toISOString().slice(0, 10);
  }
  if (typeof raw === "string") {
    const ddmm = raw.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (ddmm) return `${ddmm[3]}-${ddmm[2]}-${ddmm[1]}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return raw.trim();
  }
  return null;
}

// ---------------------------------------------------------------------------
// Extract flat number from description heuristics
// Examples:
//   "FAST:Remezan Öksüz Apt aidat.ödem"   → try to find flat in description
//   "7777/MBL-7529073-Levent Akçay-maa"   → payroll / EFT, no flat
//   "Daire 12 aidat"                       → 12
//   "3 No'lu Daire aidat"                  → 3
//   "#5 aidat"                             → 5
// ---------------------------------------------------------------------------
function parseFlatNumber(desc: string): number | null {
  const patterns = [
    /daire\s*n[oö]?\s*[:.#]?\s*(\d+)/i,
    /(\d+)\s*no\.?\s*(?:lu\s+)?daire/i,
    /flat\s*#?\s*(\d+)/i,
    /#\s*(\d+)/,
    /\bno\.?\s*(\d{1,3})\b/i,
    /\bd\.?\s*(\d{1,3})\b/,
    /\b(\d{1,3})\s*nolu\b/i,
    // "aidat.ödem" style: look for a number anywhere in the description
    /\b(\d{1,3})\b/,
  ];

  for (const p of patterns) {
    const m = desc.match(p);
    if (m) {
      const n = parseInt(m[1]);
      if (n >= 1 && n <= 999) return n;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Try to find an existing invoice for auto-matching (Income rows only)
// Matches by flat number + amount due
// ---------------------------------------------------------------------------
async function tryAutoMatch(
  flatNumber: number | null,
  amount: number,
): Promise<number | null> {
  if (!flatNumber) return null;

  const matching = await db
    .select({ invoiceId: monthlyInvoices.id })
    .from(monthlyInvoices)
    .innerJoin(flats, eq(flats.id, monthlyInvoices.flatId))
    .where(
      and(
        eq(flats.flatNumber, flatNumber),
        eq(monthlyInvoices.totalDue, amount.toFixed(2)),
      ),
    )
    .limit(1);

  return matching[0]?.invoiceId ?? null;
}

// ---------------------------------------------------------------------------
// POST /api/bank-import
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });

  const nodeBuffer = Buffer.from(await file.arrayBuffer());
  const workbook = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(nodeBuffer as any);
  const sheet = workbook.worksheets[0];

  if (!sheet) return NextResponse.json({ error: "No worksheet found." }, { status: 400 });

  const batchId = randomUUID();
  const records: (typeof bankStatementImports.$inferInsert)[] = [];
  const skipped: string[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= HEADER_ROWS) return;

    const rawDate = row.getCell(COL_DATE).value;
    const rawAmount = row.getCell(COL_AMOUNT).value;
    const rawDirection = row.getCell(COL_DIRECTION).value;
    const rawDesc = row.getCell(COL_DESCRIPTION).value;
    const rawReceipt = row.getCell(COL_RECEIPT).value;

    // Skip completely empty rows
    if (!rawDate && !rawAmount) return;

    // --- Date ---
    const parsedDate = parseTurkishDate(rawDate);
    if (!parsedDate) {
      skipped.push(`Row ${rowNumber}: invalid date "${rawDate}"`);
      return;
    }

    // --- Amount ---
    const amount = parseTurkishNumber(rawAmount);
    if (amount === null || isNaN(amount)) {
      skipped.push(`Row ${rowNumber}: invalid amount "${rawAmount}"`);
      return;
    }

    // --- Direction: "B" = Borç (expense), "A" = Alacak (income) ---
    // Also fall back to sign of amount if the column is missing
    let direction: "Gelir" | "Gider";
    const dirStr = rawDirection ? String(rawDirection).trim().toUpperCase() : "";
    if (dirStr === "B") {
      direction = "Gider";
    } else if (dirStr === "A") {
      direction = "Gelir";
    } else {
      // Fallback: negative amount = expense
      direction = amount < 0 ? "Gider" : "Gelir";
    }

    // Store the absolute amount (direction is captured separately)
    const absAmount = Math.abs(amount);

    // --- Description ---
    const description = rawDesc ? String(rawDesc).trim() : "";

    // --- Receipt number (append to description for traceability) ---
    const receiptNo = rawReceipt ? String(rawReceipt).trim() : "";
    const fullDescription = receiptNo
      ? `${description} [${receiptNo}]`
      : description || null;

    // --- Parse flat number (only meaningful for Income/aidat rows) ---
    const parsedFlatNumber =
      direction === "Gelir" ? parseFlatNumber(description) : null;

    records.push({
      batchId,
      rawDate: parsedDate,
      rawAmount: absAmount.toFixed(2),
      rawDescription: fullDescription,
      parsedFlatNumber,
      direction,
      status: "Bekliyor",
    });
  });

  if (records.length === 0) {
    return NextResponse.json(
      {
        error: "No valid rows found in the file.",
        skipped,
      },
      { status: 400 },
    );
  }

  // Insert all records
  const inserted = await db
    .insert(bankStatementImports)
    .values(records)
    .returning();

  // Auto-match Income rows against outstanding invoices
  let autoMatchCount = 0;
  for (const row of inserted) {
    if (row.direction !== "Gelir") continue;

    const invoiceId = await tryAutoMatch(
      row.parsedFlatNumber,
      parseFloat(row.rawAmount),
    );
    if (invoiceId) {
      await db
        .update(bankStatementImports)
        .set({ status: "Otomatik Eşleşti", linkedInvoiceId: invoiceId })
        .where(eq(bankStatementImports.id, row.id));
      autoMatchCount++;
    }
  }

  return NextResponse.json({
    batchId,
    total: records.length,
    autoMatched: autoMatchCount,
    skipped: skipped.length > 0 ? skipped : undefined,
  });
}
