"use server";

import { db } from "@/lib/db";
import {
  bankStatementImports, monthlyInvoices, transactions, accounts, vendorPayables,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import Decimal from "decimal.js";
import { z } from "zod";
import { recalculatePayableStatus } from "./vendor-payables";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function updateInvoiceStatus(invoiceId: number) {
  const [inv] = await db
    .select({
      totalDue: monthlyInvoices.totalDue,
      amountPaid: monthlyInvoices.amountPaid,
    })
    .from(monthlyInvoices)
    .where(eq(monthlyInvoices.id, invoiceId))
    .limit(1);

  if (!inv) return;

  const due = new Decimal(inv.totalDue);
  const paid = new Decimal(inv.amountPaid ?? "0");
  let status: "Ödenmedi" | "Kısmi" | "Ödendi" | "Fazla Ödendi" = "Ödenmedi";

  if (paid.isZero()) status = "Ödenmedi";
  else if (paid.lt(due)) status = "Kısmi";
  else if (paid.eq(due)) status = "Ödendi";
  else status = "Fazla Ödendi";

  await db
    .update(monthlyInvoices)
    .set({ status })
    .where(eq(monthlyInvoices.id, invoiceId));
}

// ---------------------------------------------------------------------------
// Income side: approve a resident payment row
// ---------------------------------------------------------------------------

export async function approveStagingRow(stagingId: number, accountId: number) {
  const session = await auth();
  if (!session) return { error: "Unauthorized" };

  const [row] = await db
    .select()
    .from(bankStatementImports)
    .where(eq(bankStatementImports.id, stagingId))
    .limit(1);

  if (!row) return { error: "Staging row not found." };
  if (row.status === "Yok Sayıldı") return { error: "Row is ignored." };

  const direction = row.direction ?? "Gelir";

  // -----------------------------------------------------------------------
  // EXPENSE direction: pay a vendor payable or record direct expense
  // -----------------------------------------------------------------------
  if (direction === "Gider") {
    if (!row.linkedPayableId) {
      // Direct expense without linked payable
      await db.insert(transactions).values({
        accountId,
        transactionType: "Gider",
        amount: row.rawAmount,
        transactionDate: row.rawDate,
        description: row.rawDescription ?? null,
      });

      const finalStatus = row.status === "Otomatik Eşleşti" ? "Otomatik Eşleşti" : "Manuel Eşleşti";
      await db
        .update(bankStatementImports)
        .set({
          status: finalStatus,
          reconciledBy: session.user?.email ?? "unknown",
        })
        .where(eq(bankStatementImports.id, stagingId));

      revalidatePath("/bank-import");
      revalidatePath("/transactions");
      revalidatePath("/accounts");
      return { success: true };
    }

    const baseAmt = new Decimal(row.baseAmount ?? row.rawAmount);
    const surchargeAmt = new Decimal(row.surchargeAmount ?? "0");

    // 1. Insert base payment transaction (reduces what we owe the vendor)
    await db.insert(transactions).values({
      accountId,
      transactionType: "Gider",
      amount: baseAmt.toFixed(2),
      transactionDate: row.rawDate,
      relatedPayableId: row.linkedPayableId,
      description: row.rawDescription ?? null,
    });

    // 2. If there is a surcharge (interest / penalty), insert a separate transaction
    //    Note: this does NOT update amountPaid on the payable.
    if (!surchargeAmt.isZero() && row.surchargeType) {
      await db.insert(transactions).values({
        accountId,
        transactionType: "Gider",
        amount: surchargeAmt.toFixed(2),
        transactionDate: row.rawDate,
        relatedPayableId: row.linkedPayableId,
        surchargeType: row.surchargeType,
        description: `${row.surchargeType} surcharge — ${row.rawDescription ?? ""}`.trim(),
      });
    }

    // 3. Update amountPaid on the payable (only base amount, NOT surcharge)
    const [payable] = await db
      .select({ amountPaid: vendorPayables.amountPaid })
      .from(vendorPayables)
      .where(eq(vendorPayables.id, row.linkedPayableId))
      .limit(1);

    const newPaid = new Decimal(payable?.amountPaid ?? "0").add(baseAmt).toFixed(2);
    await db
      .update(vendorPayables)
      .set({ amountPaid: newPaid })
      .where(eq(vendorPayables.id, row.linkedPayableId));

    await recalculatePayableStatus(row.linkedPayableId);

    // 4. Mark staging row reconciled
    const finalStatus = row.status === "Otomatik Eşleşti" ? "Otomatik Eşleşti" : "Manuel Eşleşti";
    await db
      .update(bankStatementImports)
      .set({
        status: finalStatus,
        reconciledBy: session.user?.email ?? "unknown",
      })
      .where(eq(bankStatementImports.id, stagingId));

    revalidatePath("/bank-import");
    revalidatePath("/vendors");
    revalidatePath("/transactions");
    return { success: true };
  }

  // -----------------------------------------------------------------------
  // INCOME direction: record a resident payment or direct income
  // -----------------------------------------------------------------------
  if (!row.linkedInvoiceId) {
    // Direct income without linked invoice
    await db.insert(transactions).values({
      accountId,
      transactionType: "Gelir",
      amount: row.rawAmount,
      transactionDate: row.rawDate,
      description: row.rawDescription ?? null,
    });

    const finalStatus = row.status === "Otomatik Eşleşti" ? "Otomatik Eşleşti" : "Manuel Eşleşti";
    await db
      .update(bankStatementImports)
      .set({
        status: finalStatus,
        reconciledBy: session.user?.email ?? "unknown",
      })
      .where(eq(bankStatementImports.id, stagingId));

    revalidatePath("/bank-import");
    revalidatePath("/transactions");
    revalidatePath("/accounts");
    return { success: true };
  }

  await db.insert(transactions).values({
    accountId,
    transactionType: "Gelir",
    amount: row.rawAmount,
    transactionDate: row.rawDate,
    relatedInvoiceId: row.linkedInvoiceId,
  });

  const [inv] = await db
    .select({ amountPaid: monthlyInvoices.amountPaid })
    .from(monthlyInvoices)
    .where(eq(monthlyInvoices.id, row.linkedInvoiceId))
    .limit(1);

  const newPaid = new Decimal(inv?.amountPaid ?? "0")
    .add(new Decimal(row.rawAmount))
    .toFixed(2);

  await db
    .update(monthlyInvoices)
    .set({ amountPaid: newPaid })
    .where(eq(monthlyInvoices.id, row.linkedInvoiceId));

  await updateInvoiceStatus(row.linkedInvoiceId);

  const finalStatus = row.status === "Otomatik Eşleşti" ? "Otomatik Eşleşti" : "Manuel Eşleşti";
  await db
    .update(bankStatementImports)
    .set({
      status: finalStatus,
      reconciledBy: session.user?.email ?? "unknown",
    })
    .where(eq(bankStatementImports.id, stagingId));

  revalidatePath("/bank-import");
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Income matching
// ---------------------------------------------------------------------------

export async function manualMatch(stagingId: number, invoiceId: number) {
  await db
    .update(bankStatementImports)
    .set({ linkedInvoiceId: invoiceId, status: "Manuel Eşleşti", direction: "Gelir" })
    .where(eq(bankStatementImports.id, stagingId));
  revalidatePath("/bank-import");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Direct match (Income or Expense without link)
// ---------------------------------------------------------------------------

export async function directMatch(stagingId: number, direction: "Gelir" | "Gider", description: string) {
  await db
    .update(bankStatementImports)
    .set({
      status: "Manuel Eşleşti",
      direction,
      rawDescription: description, // Save description to row so it's used when creating transaction
      linkedInvoiceId: null,
      linkedPayableId: null,
    })
    .where(eq(bankStatementImports.id, stagingId));
  revalidatePath("/bank-import");
  return { success: true };
}

export async function unmatchStagingRow(stagingId: number) {
  await db
    .update(bankStatementImports)
    .set({
      status: "Bekliyor",
      direction: null, // Allow direction to be reset or keep default
      linkedInvoiceId: null,
      linkedPayableId: null,
      baseAmount: null,
      surchargeAmount: null,
      surchargeType: null,
    })
    .where(eq(bankStatementImports.id, stagingId));
  revalidatePath("/bank-import");
  return { success: true };
}

export async function revertStagingRow(stagingId: number) {
  await db
    .update(bankStatementImports)
    .set({
      reconciledBy: null,
      status: "Bekliyor",
      direction: null,
      linkedInvoiceId: null,
      linkedPayableId: null,
      baseAmount: null,
      surchargeAmount: null,
      surchargeType: null,
    })
    .where(eq(bankStatementImports.id, stagingId));
  revalidatePath("/bank-import");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Expense matching: link a staging row to a vendor payable
// ---------------------------------------------------------------------------

export async function linkPayableToStagingRow(
  stagingId: number,
  payableId: number,
  baseAmount: number,
  surchargeAmount?: number,
  surchargeType?: "Faiz" | "Ceza" | "Ücret" | "Yuvarlama",
) {
  const schema = z.object({
    payableId: z.number().int().positive(),
    baseAmount: z.number().min(0),
    surchargeAmount: z.number().min(0).optional(),
    surchargeType: z.enum(["Faiz", "Ceza", "Ücret", "Yuvarlama"]).optional(),
  });

  const parsed = schema.safeParse({ payableId, baseAmount, surchargeAmount, surchargeType });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await db
    .update(bankStatementImports)
    .set({
      direction: "Gider",
      linkedPayableId: payableId,
      baseAmount: baseAmount.toFixed(2),
      surchargeAmount: surchargeAmount ? surchargeAmount.toFixed(2) : null,
      surchargeType: surchargeType ?? null,
      status: "Manuel Eşleşti",
    })
    .where(eq(bankStatementImports.id, stagingId));

  revalidatePath("/bank-import");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

export async function ignoreStagingRow(stagingId: number) {
  await db
    .update(bankStatementImports)
    .set({ status: "Yok Sayıldı" })
    .where(eq(bankStatementImports.id, stagingId));
  revalidatePath("/bank-import");
  return { success: true };
}

export async function deleteStagingBatch(batchId: string) {
  await db
    .delete(bankStatementImports)
    .where(eq(bankStatementImports.batchId, batchId));
  revalidatePath("/bank-import");
  return { success: true };
}
