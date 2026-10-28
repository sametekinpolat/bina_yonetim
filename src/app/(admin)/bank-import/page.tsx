import { db } from "@/lib/db";
import {
  bankStatementImports, accounts, monthlyInvoices, billingPeriods, flats,
  vendors,
} from "@/lib/db/schema";
import { and, eq, desc, inArray, ne, sql } from "drizzle-orm";
import { UploadForm } from "@/components/admin/bank-import/upload-form";
import { StagingTable } from "@/components/admin/bank-import/staging-table";

export default async function BankImportPage() {
  const stagingRows = await db
    .select({
      id: bankStatementImports.id,
      batchId: bankStatementImports.batchId,
      fileName: bankStatementImports.fileName,
      rawDate: bankStatementImports.rawDate,
      rawAmount: bankStatementImports.rawAmount,
      rawDescription: bankStatementImports.rawDescription,
      parsedFlatNumber: bankStatementImports.parsedFlatNumber,
      status: bankStatementImports.status,
      direction: bankStatementImports.direction,
      linkedInvoiceId: bankStatementImports.linkedInvoiceId,
      linkedSplitInvoiceId: bankStatementImports.linkedSplitInvoiceId,
      linkedInvoiceAmount: bankStatementImports.linkedInvoiceAmount,
      linkedVendorId: bankStatementImports.linkedVendorId,
      linkedTransferAccountId: bankStatementImports.linkedTransferAccountId,
      baseAmount: bankStatementImports.baseAmount,
      surchargeAmount: bankStatementImports.surchargeAmount,
      surchargeType: bankStatementImports.surchargeType,
      invoiceLabel: billingPeriods.periodName,
      invoicePeriodType: billingPeriods.periodType,
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

  const splitInvoiceIds = [...new Set(stagingRows.flatMap((row) => row.linkedSplitInvoiceId ? [row.linkedSplitInvoiceId] : []))];
  const splitInvoiceRows = splitInvoiceIds.length
    ? await db.select({
        id: monthlyInvoices.id,
        periodName: billingPeriods.periodName,
        periodType: billingPeriods.periodType,
        flatNumber: flats.flatNumber,
      }).from(monthlyInvoices)
        .innerJoin(billingPeriods, eq(billingPeriods.id, monthlyInvoices.periodId))
        .innerJoin(flats, eq(flats.id, monthlyInvoices.flatId))
        .where(inArray(monthlyInvoices.id, splitInvoiceIds))
    : [];
  const splitInvoiceMap = new Map(splitInvoiceRows.map((invoice) => [
    invoice.id,
    `${invoice.periodName}${invoice.periodType === "Ek Dönem" ? " (Ek Dönem)" : ""} — Daire #${invoice.flatNumber}`,
  ]));

  const allAccounts = await db
    .select({ id: accounts.id, accountName: accounts.accountName })
    .from(accounts)
    .orderBy(accounts.accountName);

  const invoiceOptionsRaw = await db
    .select({
      id: monthlyInvoices.id,
      periodId: billingPeriods.id,
      periodName: billingPeriods.periodName,
      periodType: billingPeriods.periodType,
      flatId: flats.id,
      flatNumber: flats.flatNumber,
      status: monthlyInvoices.status,
      totalDue: monthlyInvoices.totalDue,
      amountPaid: monthlyInvoices.amountPaid,
    })
    .from(monthlyInvoices)
    .innerJoin(billingPeriods, eq(billingPeriods.id, monthlyInvoices.periodId))
    .innerJoin(flats, eq(flats.id, monthlyInvoices.flatId))
    .where(and(
      inArray(monthlyInvoices.status, ["Ödenmedi", "Kısmi"]),
      ne(billingPeriods.status, "Taslak"),
    ))
    .orderBy(desc(billingPeriods.periodYear), desc(billingPeriods.periodMonth), flats.flatNumber);

  // Calculate flat net balances to hide invoices if the flat has no overall debt
  const flatRows = await db
    .select({
      flatId: flats.id,
      periodId: billingPeriods.id,
      periodType: billingPeriods.periodType,
      totalDue: sql<string>`COALESCE(SUM(CASE WHEN ${billingPeriods.status} != 'Taslak' THEN ${monthlyInvoices.totalDue}::numeric ELSE 0 END), 0)`,
      totalPaid: sql<string>`COALESCE(SUM(CASE WHEN ${billingPeriods.status} != 'Taslak' THEN ${monthlyInvoices.amountPaid}::numeric ELSE 0 END), 0)`,
    })
    .from(flats)
    .leftJoin(monthlyInvoices, eq(monthlyInvoices.flatId, flats.id))
    .leftJoin(billingPeriods, eq(billingPeriods.id, monthlyInvoices.periodId))
    .groupBy(flats.id, billingPeriods.id, billingPeriods.periodType);

  const flatBalances = new Map<string, number>();
  for (const f of flatRows) {
    const bucket = f.periodType === "Ek Dönem" ? `ek:${f.periodId}` : "aylik";
    const key = `${f.flatId}:${bucket}`;
    flatBalances.set(key, (flatBalances.get(key) ?? 0) + Number(f.totalDue) - Number(f.totalPaid));
  }

  const rows = stagingRows.map((r) => ({
    ...r,
    splitInvoiceLabel: r.linkedSplitInvoiceId ? splitInvoiceMap.get(r.linkedSplitInvoiceId) ?? null : null,
    direction: (r.direction ?? "Gelir") as "Gelir" | "Gider",
    invoiceLabel: r.invoiceLabel
      ? `${r.invoiceLabel}${r.invoicePeriodType === "Ek Dönem" ? " (Ek Dönem)" : ""} — Daire #${r.invoiceFlatNumber}`
      : null,
    vendorLabel: r.linkedVendorId
      ? (() => {
          const v = vendorMap.get(r.linkedVendorId);
          return v ? v.name : null;
        })()
      : null,
    transferAccountLabel: r.linkedTransferAccountId
      ? allAccounts.find((a) => a.id === r.linkedTransferAccountId)?.accountName ?? null
      : null,
  }));

  const invoices = invoiceOptionsRaw
    .filter((inv) => {
      // Only show the invoice in the dropdown if the flat ACTUALLY owes money overall
      const bucket = inv.periodType === "Ek Dönem" ? `ek:${inv.periodId}` : "aylik";
      const net = flatBalances.get(`${inv.flatId}:${bucket}`) || 0;
      // Allow a small epsilon for floating point / decimal rounding
      return net > 0.01;
    })
    .map((inv) => {
      const remaining = Number(inv.totalDue) - Number(inv.amountPaid || 0);
      const bucket = inv.periodType === "Ek Dönem" ? `ek:${inv.periodId}` : "aylik";
      const flatNet = flatBalances.get(`${inv.flatId}:${bucket}`) || 0;
      return {
        id: inv.id,
        flatId: inv.flatId,
        periodType: inv.periodType,
        label: `${inv.periodName}${inv.periodType === "Ek Dönem" ? " (Ek Dönem)" : ""} — Daire #${inv.flatNumber} (Kalan: ₺${remaining.toLocaleString("tr-TR")} / Bu tür bakiye: ₺${flatNet.toLocaleString("tr-TR")})`,
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
