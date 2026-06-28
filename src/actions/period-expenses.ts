"use server";

import { db } from "@/lib/db";
import { periodPlanExpenses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const itemSchema = z.object({
  description: z.string().min(1).max(200),
  amount: z.coerce.number().min(0),
  vendorId: z.coerce.number().int().positive().optional().nullable(),
});

export async function addPeriodExpense(
  periodId: number,
  description: string,
  amount: number,
  presetId?: number,
  vendorId?: number | null,
) {
  const parsed = itemSchema.safeParse({ description, amount, vendorId: vendorId ?? null });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const [item] = await db
      .insert(periodPlanExpenses)
      .values({
        periodId,
        description: parsed.data.description,
        amount: parsed.data.amount.toString(),
        presetId: presetId ?? null,
        vendorId: parsed.data.vendorId ?? null,
      })
      .returning();
    revalidatePath(`/periods/${periodId}`);
    return { success: true, id: item.id };
  } catch {
    return { error: "Failed to add expense." };
  }
}

export async function updatePeriodExpense(
  id: number,
  periodId: number,
  description: string,
  amount: number,
  vendorId?: number | null,
) {
  const parsed = itemSchema.safeParse({ description, amount, vendorId: vendorId ?? null });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await db
      .update(periodPlanExpenses)
      .set({
        description: parsed.data.description,
        amount: parsed.data.amount.toString(),
        vendorId: parsed.data.vendorId ?? null,
      })
      .where(eq(periodPlanExpenses.id, id));
    revalidatePath(`/periods/${periodId}`);
    return { success: true };
  } catch {
    return { error: "Failed to update expense." };
  }
}

export async function removePeriodExpense(id: number, periodId: number) {
  try {
    await db.delete(periodPlanExpenses).where(eq(periodPlanExpenses.id, id));
    revalidatePath(`/periods/${periodId}`);
    return { success: true };
  } catch {
    return { error: "Failed to remove expense." };
  }
}
