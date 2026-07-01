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
          periodStatus: billingPeriods.status,
        })
        .from(monthlyInvoices)
        .innerJoin(billingPeriods, eq(monthlyInvoices.periodId, billingPeriods.id))
        .where(eq(monthlyInvoices.flatId, flat.id))
        .orderBy(billingPeriods.periodYear, billingPeriods.periodMonth);

      if (invoices.length === 0) continue;

      // Sum all amountPaid for this flat (including trapped amounts in draft invoices)
      let totalPaidPool = new Decimal(0);
      for (const inv of invoices) {
        totalPaidPool = totalPaidPool.add(new Decimal(inv.amountPaid || "0"));
      }

      // Separate draft and active invoices
      const activeInvoices = invoices.filter(inv => inv.periodStatus !== "Taslak");
      const draftInvoices = invoices.filter(inv => inv.periodStatus === "Taslak");

      // Reset any trapped credits in draft invoices to 0
      for (const inv of draftInvoices) {
        if (new Decimal(inv.amountPaid || "0").greaterThan(0)) {
          await db
            .update(monthlyInvoices)
            .set({ amountPaid: "0", status: "Ödenmedi" })
            .where(eq(monthlyInvoices.id, inv.id));
        }
      }

      // Redistribute only among active invoices
      if (activeInvoices.length > 0) {
        for (let i = 0; i < activeInvoices.length; i++) {
          const inv = activeInvoices[i];
          const due = new Decimal(inv.totalDue || "0");

          let allocated = new Decimal(0);

          // If it's the last active invoice, it absorbs all remaining pool
          if (i === activeInvoices.length - 1) {
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

          let status: "Ödenmedi" | "Kısmi" | "Ödendi" | "Fazla Ödendi" = "Ödenmedi";
          if (allocated.isZero()) status = "Ödenmedi";
          else if (allocated.lt(due)) status = "Kısmi";
          else if (allocated.eq(due)) status = "Ödendi";
          else status = "Fazla Ödendi";

          await db
            .update(monthlyInvoices)
            .set({ amountPaid: allocated.toFixed(2), status })
            .where(eq(monthlyInvoices.id, inv.id));
        }
      } else if (draftInvoices.length > 0 && totalPaidPool.greaterThan(0)) {
        // If there are literally no active invoices, we have no choice but to store it on the draft invoice
        // otherwise the money disappears from the database entirely.
        await db
          .update(monthlyInvoices)
          .set({ amountPaid: totalPaidPool.toFixed(2), status: "Fazla Ödendi" })
          .where(eq(monthlyInvoices.id, draftInvoices[0].id));
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
