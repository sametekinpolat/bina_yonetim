import Link from "next/link";
import { db } from "@/lib/db";
import {
  flats, monthlyInvoices, flatRelationships, people, billingPeriods
} from "@/lib/db/schema";
import { eq, sql, isNull } from "drizzle-orm";
import Decimal from "decimal.js";
import { CreditCard, TrendingDown, TrendingUp, FileText } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { DistributeCreditsButton } from "@/components/admin/debts/distribute-credits-button";

function fmt(val: string | number) {
  return `₺${Number(val).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`;
}

export default async function DebtsPage() {
  const [flatRows, extraInvoiceRows, residentRows] = await Promise.all([
    db
      .select({
        flatId: flats.id,
        flatNumber: flats.flatNumber,
        monthlyDue: sql<string>`COALESCE(SUM(CASE WHEN ${billingPeriods.status} != 'Taslak' AND ${billingPeriods.periodType} = 'Aylık' THEN ${monthlyInvoices.totalDue}::numeric ELSE 0 END), 0)`.as("monthly_due"),
        monthlyPaid: sql<string>`COALESCE(SUM(CASE WHEN ${billingPeriods.status} != 'Taslak' AND ${billingPeriods.periodType} = 'Aylık' THEN ${monthlyInvoices.amountPaid}::numeric ELSE 0 END), 0)`.as("monthly_paid"),
      })
      .from(flats)
      .leftJoin(monthlyInvoices, eq(monthlyInvoices.flatId, flats.id))
      .leftJoin(billingPeriods, eq(billingPeriods.id, monthlyInvoices.periodId))
      .groupBy(flats.id, flats.flatNumber)
      .orderBy(flats.flatNumber),

    db.select({
      periodId: billingPeriods.id,
      periodName: billingPeriods.periodName,
      flatId: flats.id,
      totalDue: monthlyInvoices.totalDue,
      amountPaid: monthlyInvoices.amountPaid,
    }).from(monthlyInvoices)
      .innerJoin(billingPeriods, eq(billingPeriods.id, monthlyInvoices.periodId))
      .innerJoin(flats, eq(flats.id, monthlyInvoices.flatId))
      .where(sql`${billingPeriods.status} != 'Taslak' AND ${billingPeriods.periodType} = 'Ek Dönem'`),

    db
      .select({
        flatId: flatRelationships.flatId,
        firstName: people.firstName,
        lastName: people.lastName,
      })
      .from(flatRelationships)
      .innerJoin(people, eq(people.id, flatRelationships.personId))
      .where(isNull(flatRelationships.moveOutDate))
      .orderBy(flatRelationships.flatId),
  ]);

  // Build resident name map (first current resident per flat)
  const residentMap = new Map<number, string>();
  for (const r of residentRows) {
    if (!residentMap.has(r.flatId)) {
      residentMap.set(r.flatId, `${r.firstName} ${r.lastName}`);
    }
  }

  // Keep monthly aidat and extra assessments as separate balances.
  const extraBalanceByFlat = new Map<number, { periodId: number; periodName: string; net: Decimal }[]>();
  for (const invoice of extraInvoiceRows) {
    const balance = new Decimal(invoice.totalDue).sub(invoice.amountPaid ?? "0");
    const current = extraBalanceByFlat.get(invoice.flatId) ?? [];
    current.push({ periodId: invoice.periodId, periodName: invoice.periodName, net: balance });
    extraBalanceByFlat.set(invoice.flatId, current);
  }
  const flatDebts = flatRows.map((f) => {
    const monthlyNet = new Decimal(f.monthlyDue).sub(f.monthlyPaid);
    const extraItems = extraBalanceByFlat.get(f.flatId) ?? [];
    const extraDebt = extraItems.reduce((sum, item) => sum.add(Decimal.max(item.net, 0)), new Decimal(0));
    const extraCredit = extraItems.reduce((sum, item) => sum.add(Decimal.max(item.net.negated(), 0)), new Decimal(0));
    return {
      flatId: f.flatId,
      flatNumber: f.flatNumber,
      residentName: residentMap.get(f.flatId) ?? null,
      monthlyNet,
      extraItems,
      extraDebt,
      extraCredit,
      debtTotal: Decimal.max(monthlyNet, 0).add(extraDebt),
    };
  });

  // Summary
  const monthlyDebt = flatDebts.reduce((a, f) => a.add(Decimal.max(f.monthlyNet, 0)), new Decimal(0));
  const monthlyCredit = flatDebts.reduce((a, f) => a.add(Decimal.max(f.monthlyNet.negated(), 0)), new Decimal(0));
  const extraDebt = flatDebts.reduce((a, f) => a.add(f.extraDebt), new Decimal(0));
  const extraCredit = flatDebts.reduce((a, f) => a.add(f.extraCredit), new Decimal(0));

  // Sort by positive debt without letting credits offset another period type.
  const sorted = [...flatDebts].sort((a, b) => {
    if (a.debtTotal.greaterThan(0) && b.debtTotal.greaterThan(0)) return b.debtTotal.cmp(a.debtTotal);
    if (a.debtTotal.greaterThan(0)) return -1;
    if (b.debtTotal.greaterThan(0)) return 1;
    return a.flatNumber - b.flatNumber;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <CreditCard className="h-6 w-6" />
            Borç Takibi
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Aylık aidat ve ek dönem borçları ayrı bakiyelerde gösterilir.
          </p>
        </div>
        <div className="flex gap-2">
          <DistributeCreditsButton />
          <a
            href="/api/reports/debts/pdf"
            download
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <FileText className="mr-1.5 h-4 w-4" />
            PDF Raporlarını İndir
          </a>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Aylık Aidat Borcu", value: monthlyDebt, icon: TrendingDown, color: "text-destructive" },
          { label: "Aylık Aidat Kredisi", value: monthlyCredit, icon: TrendingUp, color: "text-cyan-600 dark:text-cyan-400" },
          { label: "Ek Dönem Borcu", value: extraDebt, icon: TrendingDown, color: "text-destructive" },
          { label: "Ek Dönem Kredisi", value: extraCredit, icon: TrendingUp, color: "text-cyan-600 dark:text-cyan-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-lg border bg-card p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{label}</p>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className={`text-2xl font-bold tabular-nums ${color}`}>{fmt(value.toString())}</p>
          </div>
        ))}
      </div>

      {/* Flat list */}
      <div className="rounded-lg border divide-y">
        {sorted.map((f) => {
          return (
            <Link
              key={f.flatId}
              href={`/debts/${f.flatId}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors"
            >
              <div>
                <p className="text-sm font-medium">Daire {f.flatNumber}</p>
                {f.residentName && (
                  <p className="text-xs text-muted-foreground">{f.residentName}</p>
                )}
              </div>
              <div className="flex flex-wrap justify-end gap-1.5">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${f.monthlyNet.greaterThan(0) ? "border-destructive/30 bg-destructive/10 text-destructive" : f.monthlyNet.lessThan(0) ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"}`}>
                  Aidat: {f.monthlyNet.lessThan(0) ? `+${fmt(f.monthlyNet.abs().toString())} kredi` : f.monthlyNet.greaterThan(0) ? `${fmt(f.monthlyNet.toString())} borç` : "borç yok"}
                </span>
                {f.extraItems.map((item) => (
                  <span key={item.periodId} className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${item.net.greaterThan(0) ? "border-destructive/30 bg-destructive/10 text-destructive" : item.net.lessThan(0) ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"}`}>
                    {item.periodName}: {item.net.greaterThan(0) ? `${fmt(item.net.toString())} borç` : item.net.lessThan(0) ? `+${fmt(item.net.abs().toString())} kredi` : "ödendi"}
                  </span>
                ))}
                {f.extraItems.length === 0 ? (
                  <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    Ek dönem: borç yok
                  </span>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
