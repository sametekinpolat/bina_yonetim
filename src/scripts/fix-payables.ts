import { db } from "../lib/db";
import { vendorPayables, transactions } from "../lib/db/schema";
import { eq } from "drizzle-orm";
import Decimal from "decimal.js";

async function recalculatePayableStatusLocal(payableId: number) {
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

async function main() {
  console.log("Recalculating all vendor payables amountPaid from transactions...");
  const payables = await db.select().from(vendorPayables);
  
  for (const p of payables) {
    const txs = await db.select().from(transactions).where(eq(transactions.relatedPayableId, p.id));
    
    let paid = new Decimal(0);
    for (const t of txs) {
      if (!t.surchargeType) {
        paid = paid.add(new Decimal(t.amount));
      }
    }
    
    console.log(`Payable ID ${p.id}: previously ${p.amountPaid}, now ${paid.toFixed(2)}`);
    
    await db
      .update(vendorPayables)
      .set({ amountPaid: paid.toFixed(2) })
      .where(eq(vendorPayables.id, p.id));
      
    await recalculatePayableStatusLocal(p.id);
  }
  
  console.log("Done.");
  process.exit(0);
}

main().catch(console.error);
