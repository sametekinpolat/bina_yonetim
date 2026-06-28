"use server";

import { db } from "@/lib/db";
import { transactions, monthlyInvoices, vendorPayables } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import Decimal from "decimal.js";
import { recalculatePayableStatus } from "./vendor-payables";

const txSchema = z.object({
  accountId: z.coerce.number().int().positive(),
  transactionType: z.enum(["Gelir", "Gider", "Transfer"]),
  amount: z.coerce.number().positive(),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  relatedInvoiceId: z.coerce.number().int().positive().optional().nullable(),
  relatedExpenseId: z.coerce.number().int().positive().optional().nullable(),
  description: z.string().optional().nullable(),
});

async function applyInvoicePayment(invoiceId: number, delta: Decimal) {
  const [inv] = await db
    .select({ totalDue: monthlyInvoices.totalDue, amountPaid: monthlyInvoices.amountPaid })
    .from(monthlyInvoices)
    .where(eq(monthlyInvoices.id, invoiceId))
    .limit(1);
  if (!inv) return;

  const due = new Decimal(inv.totalDue);
  const newPaid = Decimal.max(new Decimal(inv.amountPaid ?? "0").add(delta), new Decimal(0));
  const newPaidStr = newPaid.toFixed(2);

  let status: "Ödenmedi" | "Kısmi" | "Ödendi" | "Fazla Ödendi";
  if (newPaid.isZero()) status = "Ödenmedi";
  else if (newPaid.lt(due)) status = "Kısmi";
  else if (newPaid.eq(due)) status = "Ödendi";
  else status = "Fazla Ödendi";

  await db
    .update(monthlyInvoices)
    .set({ amountPaid: newPaidStr, status })
    .where(eq(monthlyInvoices.id, invoiceId));
}

async function applyPayablePayment(payableId: number, delta: Decimal) {
  const [payable] = await db
    .select({ amountPaid: vendorPayables.amountPaid })
    .from(vendorPayables)
    .where(eq(vendorPayables.id, payableId))
    .limit(1);
  if (!payable) return;

  const newPaid = Decimal.max(new Decimal(payable.amountPaid ?? "0").add(delta), new Decimal(0));
  await db
    .update(vendorPayables)
    .set({ amountPaid: newPaid.toFixed(2) })
    .where(eq(vendorPayables.id, payableId));

  await recalculatePayableStatus(payableId);
}

export async function createTransaction(formData: FormData) {
  const parsed = txSchema.safeParse({
    accountId: formData.get("accountId"),
    transactionType: formData.get("transactionType"),
    amount: formData.get("amount"),
    transactionDate: formData.get("transactionDate"),
    relatedInvoiceId: formData.get("relatedInvoiceId") || null,
    relatedExpenseId: formData.get("relatedExpenseId") || null,
    description: formData.get("description") || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await db.insert(transactions).values({
      ...parsed.data,
      amount: parsed.data.amount.toString(),
    });

    if (parsed.data.transactionType === "Gelir" && parsed.data.relatedInvoiceId) {
      await applyInvoicePayment(
        parsed.data.relatedInvoiceId,
        new Decimal(parsed.data.amount)
      );
    }

    revalidatePath("/transactions");
    revalidatePath("/accounts");
    revalidatePath("/debts");
    return { success: true };
  } catch {
    return { error: "Failed to create transaction." };
  }
}

export async function deleteTransaction(id: number) {
  try {
    const [tx] = await db
      .select({
        transactionType: transactions.transactionType,
        amount: transactions.amount,
        relatedInvoiceId: transactions.relatedInvoiceId,
        relatedPayableId: transactions.relatedPayableId,
        surchargeType: transactions.surchargeType,
      })
      .from(transactions)
      .where(eq(transactions.id, id))
      .limit(1);

    await db.delete(transactions).where(eq(transactions.id, id));

    if (tx?.transactionType === "Gelir" && tx.relatedInvoiceId) {
      await applyInvoicePayment(
        tx.relatedInvoiceId,
        new Decimal(tx.amount).negated()
      );
    } else if (tx?.transactionType === "Gider" && tx.relatedPayableId && !tx.surchargeType) {
      await applyPayablePayment(
        tx.relatedPayableId,
        new Decimal(tx.amount).negated()
      );
    }

    revalidatePath("/transactions");
    revalidatePath("/accounts");
    revalidatePath("/debts");
    revalidatePath("/vendors");
    revalidatePath("/bank-import");
    return { success: true };
  } catch {
    return { error: "Failed to delete transaction." };
  }
}
