"use server";

import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recalculateInvoicePayment } from "@/lib/db/invoice-payments";

const txSchema = z.object({
  accountId: z.coerce.number().int().positive(),
  toAccountId: z.coerce.number().int().positive().optional().nullable(),
  transactionType: z.enum(["Gelir", "Gider", "Transfer"]),
  amount: z.coerce.number().positive(),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  relatedInvoiceId: z.coerce.number().int().positive().optional().nullable(),
  vendorId: z.coerce.number().int().positive().optional().nullable(),
  description: z.string().optional().nullable(),
});

export async function createTransaction(formData: FormData) {
  const parsed = txSchema.safeParse({
    accountId: formData.get("accountId"),
    toAccountId: formData.get("toAccountId") || null,
    transactionType: formData.get("transactionType"),
    amount: formData.get("amount"),
    transactionDate: formData.get("transactionDate"),
    relatedInvoiceId: formData.get("relatedInvoiceId") || null,
    vendorId: formData.get("vendorId") || null,
    description: formData.get("description") || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    if (parsed.data.transactionType === "Transfer" && parsed.data.toAccountId) {
      // Create two records for transfer: one out (positive amount -> subtracts), one in (negative amount -> adds)
      await db.insert(transactions).values([
        {
          accountId: parsed.data.accountId,
          transactionType: "Transfer",
          amount: parsed.data.amount.toString(),
          transactionDate: parsed.data.transactionDate,
          description: parsed.data.description || "Transfer (Çıkış)",
        },
        {
          accountId: parsed.data.toAccountId,
          transactionType: "Transfer",
          amount: (-parsed.data.amount).toString(),
          transactionDate: parsed.data.transactionDate,
          description: parsed.data.description || "Transfer (Giriş)",
        }
      ]);
    } else {
      await db.insert(transactions).values({
        accountId: parsed.data.accountId,
        transactionType: parsed.data.transactionType,
        amount: parsed.data.amount.toString(),
        transactionDate: parsed.data.transactionDate,
        relatedInvoiceId: parsed.data.relatedInvoiceId,
        vendorId: parsed.data.vendorId,
        description: parsed.data.description,
      });
    }

    if (parsed.data.transactionType === "Gelir" && parsed.data.relatedInvoiceId) {
      await recalculateInvoicePayment(parsed.data.relatedInvoiceId);
    }

    revalidatePath("/transactions");
    revalidatePath("/accounts");
    revalidatePath("/debts");
    return { success: true };
  } catch (err) {
    console.error(err);
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
        vendorId: transactions.vendorId,
        surchargeType: transactions.surchargeType,
      })
      .from(transactions)
      .where(eq(transactions.id, id))
      .limit(1);

    await db.delete(transactions).where(eq(transactions.id, id));

    if (tx?.transactionType === "Gelir" && tx.relatedInvoiceId) {
      await recalculateInvoicePayment(tx.relatedInvoiceId);
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
