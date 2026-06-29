import { db } from "@/lib/db";
import {
  bankStatementImports, accounts, monthlyInvoices, billingPeriods, flats,
  vendors,
} from "@/lib/db/schema";
import { eq, desc, inArray, sql } from "drizzle-orm";
import { UploadForm } from "@/components/admin/bank-import/upload-form";
import { StagingTable } from "@/components/admin/bank-import/staging-table";

export default async function BankImportPage() {
  const stagingRows = await db
    .select({
      id: bankStatementImports.id,
      batchId: bankStatementImports.batchId,
      rawDate: bankStatementImports.rawDate,
      rawAmount: bankStatementImports.rawAmount,
      rawDescription: bankStatementImports.rawDescription,
      parsedFlatNumber: bankStatementImports.parsedFlatNumber,
      status: bankStatementImports.status,
      direction: bankStatementImports.direction,
      linkedInvoiceId: bankStatementImports.linkedInvoiceId,
      linkedVendorId: bankStatementImports.linkedVendorId,
      baseAmount: bankStatementImports.baseAmount,
      surchargeAmount: bankStatementImports.surchargeAmount,
      surchargeType: bankStatementImports.surchargeType,
      invoiceLabel: billingPeriods.periodName,
      invoiceFlatNumber: flats.flatNumber,
      reconciledBy: bankStatementImports.reconciledBy,
    })
    .from(bankStatementImports)
    .leftJoin(monthlyInvoices, eq(monthlyInvoices.id, bankStatementImports.linkedInvoiceId))
    .leftJoin(billingPeriods, eq(billingPeriods.id, monthlyInvoices.periodId))
    .leftJoin(flats, eq(flats.id, monthlyInvoices.flatId))
    .orderBy(desc(bankStatementImports.rawDate), desc(bankStatementImports.id));

  // Fetch all vendors for the expense dropdown
  const allVendors = await db
    .select({
      id: vendors.id,
      name: vendors.name,
    })
    .from(vendors)
    .orderBy(vendors.name);

  const vendorMap = new Map(allVendors.map((v) => [v.id, v]));

  const allAccounts = await db
    .select({ id: accounts.id, accountName: accounts.accountName })
    .from(accounts)
    .orderBy(accounts.accountName);

  const invoiceOptionsRaw = await db
    .select({
      id: monthlyInvoices.id,
      periodName: billingPeriods.periodName,
      flatId: flats.id,
      flatNumber: flats.flatNumber,
      status: monthlyInvoices.status,
      totalDue: monthlyInvoices.totalDue,
      amountPaid: monthlyInvoices.amountPaid,
    })
    .from(monthlyInvoices)
    .innerJoin(billingPeriods, eq(billingPeriods.id, monthlyInvoices.periodId))
    .innerJoin(flats, eq(flats.id, monthlyInvoices.flatId))
    .where(inArray(monthlyInvoices.status, ["Ödenmedi", "Kısmi"]))
    .orderBy(desc(billingPeriods.periodYear), desc(billingPeriods.periodMonth), flats.flatNumber);

  // Calculate flat net balances to hide invoices if the flat has no overall debt
  const flatRows = await db
    .select({
      flatId: flats.id,
      totalDue: sql<string>`COALESCE(SUM(${monthlyInvoices.totalDue}::numeric), 0)`,
      totalPaid: sql<string>`COALESCE(SUM(${monthlyInvoices.amountPaid}::numeric), 0)`,
    })
    .from(flats)
    .leftJoin(monthlyInvoices, eq(monthlyInvoices.flatId, flats.id))
    .groupBy(flats.id);

  const flatBalances = new Map<number, number>();
  for (const f of flatRows) {
    flatBalances.set(f.flatId, Number(f.totalDue) - Number(f.totalPaid));
  }

  const rows = stagingRows.map((r) => ({
    ...r,
    direction: (r.direction ?? "Gelir") as "Gelir" | "Gider",
    invoiceLabel: r.invoiceLabel
      ? `${r.invoiceLabel} — Daire #${r.invoiceFlatNumber}`
      : null,
    vendorLabel: r.linkedVendorId
      ? (() => {
          const v = vendorMap.get(r.linkedVendorId);
          return v ? v.name : null;
        })()
      : null,
  }));

  const invoices = invoiceOptionsRaw
    .filter((inv) => {
      // Only show the invoice in the dropdown if the flat ACTUALLY owes money overall
      const net = flatBalances.get(inv.flatId) || 0;
      // Allow a small epsilon for floating point / decimal rounding
      return net > 0.01;
    })
    .map((inv) => {
      const remaining = Number(inv.totalDue) - Number(inv.amountPaid || 0);
      const flatNet = flatBalances.get(inv.flatId) || 0;
      return {
        id: inv.id,
        label: `${inv.periodName} — Daire #${inv.flatNumber} (Fatura Kalan: ₺${remaining.toLocaleString("tr-TR")} / Toplam Daire Borcu: ₺${flatNet.toLocaleString("tr-TR")})`,
      };
    });

  const vendorOptions = allVendors.map((v) => ({
    id: v.id,
    label: v.name,
  }));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Banka İçe Aktarma</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Banka ekstresini yükleyin. Gelir satırlarını daire faturalarına, gider satırlarını firmalara (carilere) eşleyin.
      </p>

      <div className="space-y-6">
        <UploadForm />
        <StagingTable rows={rows as any} accounts={allAccounts} invoices={invoices} vendors={vendorOptions} />
      </div>
    </div>
  );
}
