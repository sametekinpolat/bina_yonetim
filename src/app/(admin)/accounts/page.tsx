import { db } from "@/lib/db";
import { accounts, transactions } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { AccountsTable } from "@/components/admin/accounts/accounts-table";

export default async function AccountsPage() {
  const rows = await db
    .select({
      id: accounts.id,
      accountName: accounts.accountName,
      accountType: accounts.accountType,
      balance: sql<string>`
        COALESCE(SUM(
          CASE WHEN ${transactions.transactionType} = 'Gelir' THEN ${transactions.amount}::numeric
               ELSE -${transactions.amount}::numeric
          END
        ), 0)
      `.as("balance"),
    })
    .from(accounts)
    .leftJoin(transactions, eq(transactions.accountId, accounts.id))
    .groupBy(accounts.id)
    .orderBy(accounts.accountName);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Hesaplar</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Banka ve kasa hesapları. Bakiye = gelirler − giderler − transferler.
      </p>
      <AccountsTable accounts={rows as any} />
    </div>
  );
}
