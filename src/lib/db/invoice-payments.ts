import { eq, sql } from "drizzle-orm";
import Decimal from "decimal.js";
import { db } from "@/lib/db";
import { flats, monthlyInvoices } from "@/lib/db/schema";

export type InvoicePaymentStatus = "Ödenmedi" | "Kısmi" | "Ödendi" | "Fazla Ödendi";

export function getInvoicePaymentStatus(totalDue: string, amountPaid: string): InvoicePaymentStatus {
  const due = new Decimal(totalDue);
  const paid = new Decimal(amountPaid);
  if (paid.lte(0)) return "Ödenmedi";
  if (paid.lt(due)) return "Kısmi";
  if (paid.eq(due)) return "Ödendi";
  return "Fazla Ödendi";
}

export async function recalculateInvoicePayment(invoiceId: number) {
  const [invoice] = await db
    .select({
      flatId: monthlyInvoices.flatId,
    })
    .from(monthlyInvoices)
    .where(eq(monthlyInvoices.id, invoiceId))
    .limit(1);

  if (!invoice) return;
  await db.execute(sql`SELECT public.refresh_flat_invoice_payments(${invoice.flatId})`);
}

export async function recalculateAllInvoicePayments() {
  const flatRows = await db.select({ id: flats.id }).from(flats);
  for (const flat of flatRows) {
    await db.execute(sql`SELECT public.refresh_flat_invoice_payments(${flat.id})`);
  }
  const invoices = await db.select({ id: monthlyInvoices.id }).from(monthlyInvoices);
  return invoices.length;
}
