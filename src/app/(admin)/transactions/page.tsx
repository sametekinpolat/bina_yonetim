import { db } from "@/lib/db";
import {
  transactions, accounts, monthlyInvoices, billingPeriods, flats, vendors,
} from "@/lib/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { TransactionsTable } from "@/components/admin/transactions/transactions-table";


export default async function TransactionsPage() {
  const txRows = await db
    .select({
      id: transactions.id,
      accountName: accounts.accountName,
      transactionType: transactions.transactionType,
      amount: transactions.amount,
      transactionDate: transactions.transactionDate,
      description: transactions.description,
      invoiceLabel: billingPeriods.periodName,
      invoiceFlatNumber: flats.flatNumber,
    })
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .leftJoin(monthlyInvoices, eq(monthlyInvoices.id, transactions.relatedInvoiceId))
    .leftJoin(billingPeriods, eq(billingPeriods.id, monthlyInvoices.periodId))
    .leftJoin(flats, eq(flats.id, monthlyInvoices.flatId))
    .orderBy(desc(transactions.transactionDate), desc(transactions.id));

  const allAccounts = await db
    .select({ id: accounts.id, accountName: accounts.accountName, accountType: accounts.accountType })
    .from(accounts)
    .orderBy(accounts.accountName);

  const allVendors = await db
    .select({ id: vendors.id, name: vendors.name })
    .from(vendors)
    .orderBy(vendors.name);

  // Invoice options for the "link to invoice" select — unpaid/partial invoices
  const invoiceOptions = await db
    .select({
      id: monthlyInvoices.id,
      periodName: billingPeriods.periodName,
      flatNumber: flats.flatNumber,
      status: monthlyInvoices.status,
    })
    .from(monthlyInvoices)
    .innerJoin(billingPeriods, eq(billingPeriods.id, monthlyInvoices.periodId))
    .innerJoin(flats, eq(flats.id, monthlyInvoices.flatId))
    .where(inArray(monthlyInvoices.status, ["Ödenmedi", "Kısmi"]))
    .orderBy(desc(billingPeriods.periodYear), desc(billingPeriods.periodMonth), flats.flatNumber);

  const rows = txRows.map((tx) => ({
    id: tx.id,
    accountName: tx.accountName,
    transactionType: tx.transactionType,
    amount: tx.amount,
    transactionDate: tx.transactionDate,
    description: tx.description,
    invoiceLabel: tx.invoiceLabel
      ? `${tx.invoiceLabel} — Daire No ${tx.invoiceFlatNumber}`
      : null,
  }));

  const invoices = invoiceOptions.map((inv) => ({
    id: inv.id,
    label: `${inv.periodName} — Daire No ${inv.flatNumber} (${inv.status})`,
  }));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">İşlemler</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Genel defter — tüm gelir, gider ve transfer kayıtları.
      </p>
      <TransactionsTable
        transactions={rows}
        accounts={allAccounts}
        invoices={invoices}
        vendors={allVendors}
      />
    </div>
  );
}
