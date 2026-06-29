"use server";

import { db } from "@/lib/db";
import { vendorPayables, vendors } from "@/lib/db/schema";
import { eq, sum, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import Decimal from "decimal.js";

const payableSchema = z.object({
  vendorId: z.coerce.number().int().positive(),
  description: z.string().min(1).max(200),
  invoiceAmount: z.coerce.number().min(0.01),
  dueDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  periodId: z.coerce.number().int().positive().optional().nullable(),
  planExpenseId: z.coerce.number().int().positive().optional().nullable(),
});

export async function createVendorPayable(formData: FormData) {
  const parsed = payableSchema.safeParse({
    vendorId: formData.get("vendorId"),
    description: formData.get("description"),
    invoiceAmount: formData.get("invoiceAmount"),
    dueDate: formData.get("dueDate") || null,
    notes: formData.get("notes") || null,
    periodId: formData.get("periodId") || null,
    planExpenseId: formData.get("planExpenseId") || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const [payable] = await db
      .insert(vendorPayables)
      .values({
        vendorId: parsed.data.vendorId,
        description: parsed.data.description,
        invoiceAmount: parsed.data.invoiceAmount.toString(),
        dueDate: parsed.data.dueDate ?? null,
        notes: parsed.data.notes ?? null,
        periodId: parsed.data.periodId ?? null,
        planExpenseId: parsed.data.planExpenseId ?? null,
      })
      .returning();
    revalidatePath("/vendors");
    revalidatePath("/bank-import");
    if (parsed.data.periodId) revalidatePath(`/periods/${parsed.data.periodId}`);
    return { success: true, id: payable.id };
  } catch {
    return { error: "Failed to create payable." };
  }
}

export async function updateVendorPayable(id: number, formData: FormData) {
  const parsed = payableSchema.safeParse({
    vendorId: formData.get("vendorId"),
    description: formData.get("description"),
    invoiceAmount: formData.get("invoiceAmount"),
    dueDate: formData.get("dueDate") || null,
    notes: formData.get("notes") || null,
    periodId: formData.get("periodId") || null,
    planExpenseId: formData.get("planExpenseId") || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await db
      .update(vendorPayables)
      .set({
        vendorId: parsed.data.vendorId,
        description: parsed.data.description,
        invoiceAmount: parsed.data.invoiceAmount.toString(),
        dueDate: parsed.data.dueDate ?? null,
        notes: parsed.data.notes ?? null,
      })
      .where(eq(vendorPayables.id, id));
    revalidatePath("/vendors");
    revalidatePath("/bank-import");
    return { success: true };
  } catch {
    return { error: "Failed to update payable." };
  }
}

export async function deleteVendorPayable(id: number) {
  try {
    await db.delete(vendorPayables).where(eq(vendorPayables.id, id));
    revalidatePath("/vendors");
    return { success: true };
  } catch {
    return { error: "Failed to delete payable." };
  }
}

/**
 * Returns the net balance for a vendor:
 *  positive = we still owe them money
 *  negative = they owe us money (credit / overpayment)
 */
export async function getVendorBalance(vendorId: number) {
  // Not heavily used anymore as UI calculates ledger, but leaving for utility
  const rows = await db
    .select()
    .from(vendorPayables)
    .where(eq(vendorPayables.vendorId, vendorId));

  const balance = rows.reduce((acc, r) => {
    return acc.add(new Decimal(r.invoiceAmount));
  }, new Decimal(0));
  // Note: Doesn't subtract payments in this simplified version since payments are in transactions now.
  // Proper ledger balance should consider transactions.

  return { balance: balance.toNumber() };
}

export type VendorPayableRow = {
  id: number;
  description: string;
  invoiceAmount: string;
  dueDate: string | null;
  notes: string | null;
  periodId: number | null;
  planExpenseId: number | null;
  createdAt: string | null;
};
