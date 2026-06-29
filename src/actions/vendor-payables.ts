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
  // Only allow deletion if nothing has been paid yet
  const [payable] = await db
    .select({ amountPaid: vendorPayables.amountPaid })
    .from(vendorPayables)
    .where(eq(vendorPayables.id, id))
    .limit(1);

  if (!payable) return { error: "Payable not found." };

  const paid = new Decimal(payable.amountPaid ?? "0");
  if (!paid.isZero()) return { error: "Cannot delete a payable that has payments recorded." };

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
export async function getVendorBalance(
  vendorId: number,
): Promise<{ balance: number; payables: VendorPayableRow[] }> {
  const rows = await db
    .select()
    .from(vendorPayables)
    .where(eq(vendorPayables.vendorId, vendorId))
    .orderBy(vendorPayables.createdAt);

  const payableRows: VendorPayableRow[] = rows.map((r) => ({
    id: r.id,
    description: r.description,
    invoiceAmount: r.invoiceAmount,
    amountPaid: r.amountPaid ?? "0",
    dueDate: r.dueDate,
    paymentStatus: r.paymentStatus ?? "Ödenmedi",
    notes: r.notes,
    periodId: r.periodId,
    planExpenseId: r.planExpenseId,
    createdAt: r.createdAt?.toISOString() ?? null,
  }));

  const balance = payableRows.reduce((acc, r) => {
    const owed = new Decimal(r.invoiceAmount).minus(new Decimal(r.amountPaid));
    return acc.add(owed);
  }, new Decimal(0));

  return { balance: balance.toNumber(), payables: payableRows };
}

export type VendorPayableRow = {
  id: number;
  description: string;
  invoiceAmount: string;
  amountPaid: string;
  dueDate: string | null;
  paymentStatus: string;
  notes: string | null;
  periodId: number | null;
  planExpenseId: number | null;
  createdAt: string | null;
};

/**
 * Recalculate paymentStatus for a payable based on amountPaid vs invoiceAmount.
 * Called internally after a payment is applied.
 */
export async function recalculatePayableStatus(payableId: number) {
  const [payable] = await db
    .select({ invoiceAmount: vendorPayables.invoiceAmount, amountPaid: vendorPayables.amountPaid })
    .from(vendorPayables)
    .where(eq(vendorPayables.id, payableId))
    .limit(1);

  if (!payable) return;

  const due = new Decimal(payable.invoiceAmount);
  const paid = new Decimal(payable.amountPaid ?? "0");

  let status: "Ödenmedi" | "Kısmi" | "Ödendi" | "Fazla Ödendi" = "Ödenmedi";
  if (paid.isZero()) status = "Ödenmedi";
  else if (paid.lt(due)) status = "Kısmi";
  else if (paid.eq(due)) status = "Ödendi";
  else status = "Fazla Ödendi";

  await db
    .update(vendorPayables)
    .set({ paymentStatus: status })
    .where(eq(vendorPayables.id, payableId));
}
