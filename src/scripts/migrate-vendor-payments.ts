import { db } from "../lib/db";
import { transactions, bankStatementImports, vendorPayables } from "../lib/db/schema";
import { eq, isNotNull, isNull, and } from "drizzle-orm";

async function main() {
  console.log("Starting data migration for vendor ledgers...");

  // 1. Migrate transactions
  const txs = await db
    .select({
      id: transactions.id,
      relatedPayableId: transactions.relatedPayableId,
    })
    .from(transactions)
    .where(
      and(
        isNotNull(transactions.relatedPayableId),
        isNull(transactions.vendorId)
      )
    );

  console.log(`Found ${txs.length} transactions to migrate.`);

  let migratedTxs = 0;
  for (const tx of txs) {
    if (tx.relatedPayableId) {
      const [payable] = await db
        .select({ vendorId: vendorPayables.vendorId })
        .from(vendorPayables)
        .where(eq(vendorPayables.id, tx.relatedPayableId))
        .limit(1);

      if (payable) {
        await db
          .update(transactions)
          .set({ vendorId: payable.vendorId })
          .where(eq(transactions.id, tx.id));
        migratedTxs++;
      }
    }
  }

  console.log(`Migrated ${migratedTxs} transactions.`);

  // 2. Migrate bank statement imports
  const imports = await db
    .select({
      id: bankStatementImports.id,
      linkedPayableId: bankStatementImports.linkedPayableId,
    })
    .from(bankStatementImports)
    .where(
      and(
        isNotNull(bankStatementImports.linkedPayableId),
        isNull(bankStatementImports.linkedVendorId)
      )
    );

  console.log(`Found ${imports.length} bank imports to migrate.`);

  let migratedImports = 0;
  for (const imp of imports) {
    if (imp.linkedPayableId) {
      const [payable] = await db
        .select({ vendorId: vendorPayables.vendorId })
        .from(vendorPayables)
        .where(eq(vendorPayables.id, imp.linkedPayableId))
        .limit(1);

      if (payable) {
        await db
          .update(bankStatementImports)
          .set({ linkedVendorId: payable.vendorId })
          .where(eq(bankStatementImports.id, imp.id));
        migratedImports++;
      }
    }
  }

  console.log(`Migrated ${migratedImports} bank imports.`);
  console.log("Migration complete.");
  process.exit(0);
}

main().catch(console.error);
