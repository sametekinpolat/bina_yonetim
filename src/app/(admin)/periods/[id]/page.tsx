import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import {
  billingPeriods,
  monthlyInvoices,
  flats,
  expensePresets,
  expenseCategories,
  periodPlanExpenses,
  vendors,
  vendorPayables,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BillsForm } from "@/components/admin/periods/bills-form";
import { PeriodActions } from "@/components/admin/periods/period-actions";
import { InvoicesTable } from "@/components/admin/periods/invoices-table";
import { PeriodExpensesSection } from "@/components/admin/periods/period-expenses-section";
import { ChevronLeft, Download, FileText } from "lucide-react";

const MONTHS = [
  "", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

const statusVariants: Record<string, "default" | "secondary" | "outline"> = {
  "Taslak": "outline",
  "Yayınlandı": "default",
  "Kapandı": "secondary",
};

function fmt(val: string | null) {
  if (!val) return "—";
  return `₺${Number(val).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`;
}

export default async function PeriodDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  console.log("PeriodDetailPage params:", resolvedParams);
  const { id: idStr } = resolvedParams;
  const id = parseInt(idStr);
  console.log("Parsed ID:", id);
  if (isNaN(id)) {
    console.log("ID is NaN, returning notFound");
    notFound();
  }

  const [period] = await db
    .select()
    .from(billingPeriods)
    .where(eq(billingPeriods.id, id))
    .limit(1);
    
  console.log("Fetched period:", period);
  if (!period) {
    console.log("Period not found in DB, returning notFound");
    notFound();
  }

  const [invoiceRows, presetRows, expenseItems, allVendors, payableRows] = await Promise.all([
    db
      .select({
        id: monthlyInvoices.id,
        flatNumber: flats.flatNumber,
        gasFee: monthlyInvoices.gasFee,
        waterFee: monthlyInvoices.waterFee,
        otherFee: monthlyInvoices.otherFee,
        totalDue: monthlyInvoices.totalDue,
        amountPaid: monthlyInvoices.amountPaid,
        status: monthlyInvoices.status,
      })
      .from(monthlyInvoices)
      .innerJoin(flats, eq(flats.id, monthlyInvoices.flatId))
      .where(eq(monthlyInvoices.periodId, id))
      .orderBy(flats.flatNumber),

    db
      .select({
        id: expensePresets.id,
        name: expensePresets.name,
        defaultAmount: expensePresets.defaultAmount,
        vendorId: expensePresets.vendorId,
      })
      .from(expensePresets)
      .innerJoin(expenseCategories, eq(expenseCategories.id, expensePresets.categoryId))
      .orderBy(expensePresets.name),

    db
      .select()
      .from(periodPlanExpenses)
      .where(eq(periodPlanExpenses.periodId, id))
      .orderBy(periodPlanExpenses.sortOrder, periodPlanExpenses.id),

    db
      .select({ id: vendors.id, name: vendors.name })
      .from(vendors)
      .orderBy(vendors.name),

    // Payables already created for this period's plan expenses
    db
      .select({ planExpenseId: vendorPayables.planExpenseId })
      .from(vendorPayables)
      .where(eq(vendorPayables.periodId, id)),
  ]);

  const isClosed = period.status === "Kapandı";

  // Build a set of planExpenseIds that already have a payable
  const payableExpenseIds = new Set(
    payableRows.map((r) => r.planExpenseId).filter(Boolean) as number[],
  );

  return (
    <div className="p-6 max-w-5xl">
      {/* Breadcrumb */}
      <Link
        href="/periods"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ChevronLeft className="h-4 w-4" />
        Dönemler
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{period.periodName}</h1>
            <Badge variant={statusVariants[period.status ?? "Taslak"]}>
              {period.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {MONTHS[period.periodMonth]} {period.periodYear}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <a
            href={`/api/reports/period/${id}`}
            download
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Excel
          </a>
          <a
            href={`/api/reports/period/${id}/pdf`}
            download
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <FileText className="mr-1.5 h-3.5 w-3.5" />
            PDF İndir
          </a>
          <PeriodActions
            periodId={id}
            status={(period.status ?? "Taslak") as "Taslak" | "Yayınlandı" | "Kapandı"}
          />
        </div>
      </div>

      <Separator className="mb-6" />

      {/* Bills input */}
      <section className="mb-8">
        <h2 className="text-base font-medium mb-3">Faturalar</h2>
        <BillsForm
          periodId={id}
          rawGasBill={period.rawGasBill}
          rawWaterBill={period.rawWaterBill}
          lowDiscountPercent={period.lowDiscountPercent}
          disabled={isClosed}
        />
      </section>

      <Separator className="mb-6" />

      {/* Planned expenses */}
      <section className="mb-8">
        <h2 className="text-base font-medium mb-3">Planlanan Giderler</h2>
        <PeriodExpensesSection
          periodId={id}
          presets={presetRows.map((p) => ({
            id: p.id,
            name: p.name,
            defaultAmount: p.defaultAmount,
            vendorId: p.vendorId,
          }))}
          items={expenseItems.map((e) => ({
            id: e.id,
            description: e.description,
            amount: e.amount,
            presetId: e.presetId,
            vendorId: e.vendorId,
            hasPayable: payableExpenseIds.has(e.id),
          }))}
          vendors={allVendors}
          disabled={isClosed}
        />
      </section>

      <Separator className="mb-6" />

      {/* Distribution summary */}
      {period.distributedGas && (
        <section className="mb-8">
          <h2 className="text-base font-medium mb-3">Dağıtım Özeti</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Dağıtılan Gaz", value: period.distributedGas },
              { label: "Dağıtılan Su", value: period.distributedWater },
              { label: "Dağıtılan Aidat", value: period.distributedDues },
              { label: "Yuvarlama Farkı", value: period.totalRoundingDiff },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-sm font-semibold tabular-nums">{fmt(value)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <Separator className="mb-6" />

      {/* Invoice breakdown */}
      <section>
        <h2 className="text-base font-medium mb-3">
          Faturalar{invoiceRows.length > 0 ? ` (${invoiceRows.length} daire)` : ""}
        </h2>
        <InvoicesTable invoices={invoiceRows.map((r) => ({
          ...r,
          gasFee: r.gasFee ?? "0",
          waterFee: r.waterFee ?? "0",
          otherFee: r.otherFee ?? "0",
          amountPaid: r.amountPaid ?? "0",
          status: r.status ?? "Ödenmedi",
        }))} />
      </section>
    </div>
  );
}
