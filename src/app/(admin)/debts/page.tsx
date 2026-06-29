import Link from "next/link";
import { db } from "@/lib/db";
import {
  flats, monthlyInvoices, flatRelationships, people, billingPeriods
} from "@/lib/db/schema";
import { eq, sql, isNull, desc } from "drizzle-orm";
import Decimal from "decimal.js";
import { CreditCard, TrendingDown, TrendingUp, FileText } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { DistributeCreditsButton } from "@/components/admin/debts/distribute-credits-button";

function fmt(val: string | number) {
  return `₺${Number(val).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`;
}

export default async function DebtsPage() {
  const [flatRows, residentRows] = await Promise.all([
    db
      .select({
        flatId: flats.id,
        flatNumber: flats.flatNumber,
        totalDue: sql<string>`COALESCE(SUM(CASE WHEN ${billingPeriods.status} != 'Taslak' THEN ${monthlyInvoices.totalDue}::numeric ELSE 0 END), 0)`.as("total_due"),
        totalPaid: sql<string>`COALESCE(SUM(CASE WHEN ${billingPeriods.status} != 'Taslak' THEN ${monthlyInvoices.amountPaid}::numeric ELSE 0 END), 0)`.as("total_paid"),
      })
      .from(flats)
      .leftJoin(monthlyInvoices, eq(monthlyInvoices.flatId, flats.id))
      .leftJoin(billingPeriods, eq(billingPeriods.id, monthlyInvoices.periodId))
      .groupBy(flats.id, flats.flatNumber)
      .orderBy(flats.flatNumber),

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

  // Compute net balance per flat
  const flatDebts = flatRows.map((f) => {
    const due = new Decimal(f.totalDue);
    const paid = new Decimal(f.totalPaid);
    const net = due.sub(paid); // positive = debt, negative = credit
    return {
      flatId: f.flatId,
      flatNumber: f.flatNumber,
      residentName: residentMap.get(f.flatId) ?? null,
      net,
    };
  });

  // Summary
  const totalDebt = flatDebts.reduce(
    (a, f) => (f.net.isPositive() ? a.add(f.net) : a),
    new Decimal(0)
  );
  const totalCredit = flatDebts.reduce(
    (a, f) => (f.net.isNegative() ? a.add(f.net.abs()) : a),
    new Decimal(0)
  );

  // Sort: debts first (desc), then no-debt, then credits last
  const sorted = [...flatDebts].sort((a, b) => {
    if (a.net.isPositive() && b.net.isPositive()) return b.net.cmp(a.net);
    if (a.net.isPositive()) return -1;
    if (b.net.isPositive()) return 1;
    if (a.net.isZero() && b.net.isZero()) return a.flatNumber - b.flatNumber;
    if (a.net.isZero()) return -1;
    if (b.net.isZero()) return 1;
    return a.net.cmp(b.net); // both negative: smaller credit first
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
            Tüm dairelerin toplam borç ve kredi durumu.
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
            PDF İndir
          </a>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Toplam Borç</p>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold tabular-nums text-destructive">
            {fmt(totalDebt.toString())}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Toplam Kredi</p>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold tabular-nums text-cyan-600 dark:text-cyan-400">
            {fmt(totalCredit.toString())}
          </p>
        </div>
      </div>

      {/* Flat list */}
      <div className="rounded-lg border divide-y">
        {sorted.map((f) => {
          const isDebt = f.net.isPositive();
          const isCredit = f.net.isNegative();

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
              <div>
                {isDebt && (
                  <span className="inline-flex items-center rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive">
                    {fmt(f.net.toString())} Borç
                  </span>
                )}
                {isCredit && (
                  <span className="inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-600 dark:text-cyan-400">
                    +{fmt(f.net.abs().toString())} Kredi
                  </span>
                )}
                {!isDebt && !isCredit && (
                  <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    Borç Yok
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
