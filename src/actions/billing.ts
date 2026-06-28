"use server";

import { db } from "@/lib/db";
import {
  billingPeriods,
  monthlyInvoices,
  flats,
  periodPlanExpenses,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { distributeBills } from "@/lib/billing";
import Decimal from "decimal.js";

const periodSchema = z.object({
  periodName: z.string().min(1).max(100),
  periodYear: z.coerce.number().int().min(2000).max(2100),
  periodMonth: z.coerce.number().int().min(1).max(12),
});

const billsSchema = z.object({
  rawGasBill: z.coerce.number().min(0).optional().nullable(),
  rawWaterBill: z.coerce.number().min(0).optional().nullable(),
  lowDiscountPercent: z.coerce.number().min(0).max(100).optional().nullable(),
});

export async function createPeriod(formData: FormData) {
  const parsed = periodSchema.safeParse({
    periodName: formData.get("periodName"),
    periodYear: formData.get("periodYear"),
    periodMonth: formData.get("periodMonth"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const [period] = await db
      .insert(billingPeriods)
      .values(parsed.data)
      .returning();
    revalidatePath("/periods");
    return { success: true, id: period.id };
  } catch {
    return { error: "Failed to create billing period." };
  }
}

export async function updatePeriodBills(id: number, formData: FormData) {
  const parsed = billsSchema.safeParse({
    rawGasBill: formData.get("rawGasBill") || null,
    rawWaterBill: formData.get("rawWaterBill") || null,
    lowDiscountPercent: formData.get("lowDiscountPercent") || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await db
      .update(billingPeriods)
      .set({
        rawGasBill: parsed.data.rawGasBill?.toString() ?? null,
        rawWaterBill: parsed.data.rawWaterBill?.toString() ?? null,
        lowDiscountPercent: parsed.data.lowDiscountPercent?.toString() ?? "15.00",
      })
      .where(eq(billingPeriods.id, id));
    revalidatePath(`/periods/${id}`);
    return { success: true };
  } catch {
    return { error: "Failed to update bills." };
  }
}

export async function calculatePeriod(id: number) {
  const [period] = await db
    .select()
    .from(billingPeriods)
    .where(eq(billingPeriods.id, id))
    .limit(1);

  if (!period) return { error: "Period not found." };
  if (period.status === "Kapandı") return { error: "Cannot recalculate a closed period." };

  // Sum period plan expenses → total dues
  const expenseItems = await db
    .select()
    .from(periodPlanExpenses)
    .where(eq(periodPlanExpenses.periodId, id));

  const totalDues =
    expenseItems.length > 0
      ? expenseItems.reduce((sum, e) => sum.add(new Decimal(e.amount)), new Decimal(0))
      : period.rawDuesPlanned
        ? new Decimal(period.rawDuesPlanned)
        : new Decimal(0);

  const rawDuesStr = totalDues.toFixed(2);

  // Fetch all flats — waterTier is now a flat-level property
  const allFlats = await db.select().from(flats).orderBy(flats.flatNumber);

  const flatInputs = allFlats.map((f) => ({
    flatId: f.id,
    waterTier: f.waterTier as "Tam" | "Düşük" | "Yok",
  }));

  const lowDiscountPercent = period.lowDiscountPercent
    ? parseFloat(period.lowDiscountPercent)
    : 15;

  const result = distributeBills(
    flatInputs,
    period.rawGasBill,
    period.rawWaterBill,
    rawDuesStr,
    lowDiscountPercent,
  );

  // Delete existing invoices and reinsert
  await db.delete(monthlyInvoices).where(eq(monthlyInvoices.periodId, id));

  await db.insert(monthlyInvoices).values(
    result.invoices.map((inv) => ({
      periodId: id,
      flatId: inv.flatId,
      gasFee: inv.gasFee.toFixed(2),
      waterFee: inv.waterFee.toFixed(2),
      otherFee: inv.otherFee.toFixed(2),
      totalDue: inv.totalDue.toFixed(2),
      amountPaid: "0",
      status: "Ödenmedi" as const,
    }))
  );

  await db
    .update(billingPeriods)
    .set({
      rawDuesPlanned: rawDuesStr,
      distributedGas: result.distributedGas.toFixed(2),
      distributedWater: result.distributedWater.toFixed(2),
      distributedDues: result.distributedDues.toFixed(2),
      totalRoundingDiff: result.totalRoundingDiff.toFixed(2),
    })
    .where(eq(billingPeriods.id, id));

  revalidatePath(`/periods/${id}`);
  return { success: true };
}

export async function publishPeriod(id: number) {
  const invoiceCount = await db
    .select({ id: monthlyInvoices.id })
    .from(monthlyInvoices)
    .where(eq(monthlyInvoices.periodId, id));

  if (invoiceCount.length === 0)
    return { error: "Calculate the period before publishing." };

  await db
    .update(billingPeriods)
    .set({ status: "Yayınlandı", publishedAt: new Date() })
    .where(eq(billingPeriods.id, id));

  revalidatePath(`/periods/${id}`);
  revalidatePath("/periods");
  return { success: true };
}

export async function closePeriod(id: number) {
  await db
    .update(billingPeriods)
    .set({ status: "Kapandı" })
    .where(eq(billingPeriods.id, id));

  revalidatePath(`/periods/${id}`);
  revalidatePath("/periods");
  return { success: true };
}

export async function deletePeriod(id: number) {
  try {
    await db.delete(monthlyInvoices).where(eq(monthlyInvoices.periodId, id));
    await db.delete(periodPlanExpenses).where(eq(periodPlanExpenses.periodId, id));
    await db.delete(billingPeriods).where(eq(billingPeriods.id, id));
    revalidatePath("/periods");
    return { success: true };
  } catch {
    return { error: "Failed to delete period." };
  }
}
