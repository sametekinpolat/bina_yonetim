"use server";

import { db } from "@/lib/db";
import { monthlyInvoices, flats, billingPeriods } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import Decimal from "decimal.js";

export async function distributeCredits() {
  try {
    const allFlats = await db.select().from(flats);

    for (const flat of allFlats) {
      // Get all invoices for this flat ordered by period
      const invoices = await db
        .select({
          id: monthlyInvoices.id,
          totalDue: monthlyInvoices.totalDue,
          amountPaid: monthlyInvoices.amountPaid,
        })
        .from(monthlyInvoices)
        .innerJoin(billingPeriods, eq(monthlyInvoices.periodId, billingPeriods.id))
        .where(eq(monthlyInvoices.flatId, flat.id))
        .orderBy(billingPeriods.periodYear, billingPeriods.periodMonth);

      if (invoices.length === 0) continue;

      // Sum all amountPaid for this flat
      let totalPaidPool = new Decimal(0);
      for (const inv of invoices) {
        totalPaidPool = totalPaidPool.add(new Decimal(inv.amountPaid || "0"));
      }

      // Redistribute
      for (let i = 0; i < invoices.length; i++) {
        const inv = invoices[i];
        const due = new Decimal(inv.totalDue || "0");

        let allocated = new Decimal(0);

        // If it's the last invoice, it absorbs all remaining pool (which could be an overpayment)
        if (i === invoices.length - 1) {
          allocated = totalPaidPool;
          totalPaidPool = new Decimal(0);
        } else {
          // Fill up to totalDue
          if (totalPaidPool.gte(due)) {
            allocated = due;
            totalPaidPool = totalPaidPool.sub(due);
          } else {
            allocated = totalPaidPool;
            totalPaidPool = new Decimal(0);
          }
        }

        // Determine status
        let status: "Ödenmedi" | "Kısmi" | "Ödendi" | "Fazla Ödendi" = "Ödenmedi";
        if (allocated.isZero()) status = "Ödenmedi";
        else if (allocated.lt(due)) status = "Kısmi";
        else if (allocated.eq(due)) status = "Ödendi";
        else status = "Fazla Ödendi";

        // Only update if something actually changed to avoid unnecessary db calls?
        // Let's just update to be safe
        await db
          .update(monthlyInvoices)
          .set({ amountPaid: allocated.toFixed(2), status })
          .where(eq(monthlyInvoices.id, inv.id));
      }
    }

    revalidatePath("/debts");
    revalidatePath("/periods");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Failed to distribute credits:", error);
    return { error: "Krediler dağıtılamadı." };
  }
}
