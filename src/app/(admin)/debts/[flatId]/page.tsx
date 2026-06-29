import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import {
  flats, monthlyInvoices, billingPeriods, flatRelationships, people,
} from "@/lib/db/schema";
import { eq, desc, isNull, and, ne } from "drizzle-orm";
import Decimal from "decimal.js";
import { ChevronLeft, Calendar } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function fmt(val: string | number) {
  return `₺${Number(val).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`;
}

const MONTHS = [
  "", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

export default async function FlatDebtDetailPage({
  params,
}: {
  params: Promise<{ flatId: string }>;
}) {
  const { flatId: flatIdStr } = await params;
  const flatId = parseInt(flatIdStr);
  if (isNaN(flatId)) notFound();

  const [flatRow] = await db
    .select()
    .from(flats)
    .where(eq(flats.id, flatId))
    .limit(1);
  if (!flatRow) notFound();

  const [invoiceRows, residentRows] = await Promise.all([
    db
      .select({
        periodId: monthlyInvoices.periodId,
        periodYear: billingPeriods.periodYear,
        periodMonth: billingPeriods.periodMonth,
        periodName: billingPeriods.periodName,
        totalDue: monthlyInvoices.totalDue,
        amountPaid: monthlyInvoices.amountPaid,
        status: monthlyInvoices.status,
      })
      .from(monthlyInvoices)
      .innerJoin(billingPeriods, eq(billingPeriods.id, monthlyInvoices.periodId))
      .where(and(
        eq(monthlyInvoices.flatId, flatId),
        ne(billingPeriods.status, "Taslak")
      ))
      .orderBy(desc(billingPeriods.periodYear), desc(billingPeriods.periodMonth)),

    db
      .select({
        firstName: people.firstName,
        lastName: people.lastName,
      })
      .from(flatRelationships)
      .innerJoin(people, eq(people.id, flatRelationships.personId))
      .where(and(eq(flatRelationships.flatId, flatId), isNull(flatRelationships.moveOutDate)))
      .limit(1),
  ]);

  const residentName = residentRows[0]
    ? `${residentRows[0].firstName} ${residentRows[0].lastName}`
    : null;

  // Net balance across all periods
  const netBalance = invoiceRows.reduce((acc: Decimal, inv: typeof invoiceRows[0]) => {
    const due = new Decimal(inv.totalDue ?? "0");
    const paid = new Decimal(inv.amountPaid ?? "0");
    return acc.add(due).sub(paid);
  }, new Decimal(0));

  const isDebt = netBalance.isPositive();
  const isCredit = netBalance.isNegative();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/debts"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1")}
        >
          <ChevronLeft className="h-4 w-4" />
          Geri
        </Link>
        <div>
          <h1 className="text-xl font-semibold">Daire {flatRow.flatNumber}</h1>
          {residentName && (
            <p className="text-sm text-muted-foreground">{residentName}</p>
          )}
        </div>
      </div>

      {/* Net balance card */}
      <div className="rounded-lg border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Net Bakiye</p>
            <p className={cn(
              "text-3xl font-bold tabular-nums mt-1",
              isDebt ? "text-destructive" : isCredit ? "text-cyan-600 dark:text-cyan-400" : "text-emerald-600 dark:text-emerald-400"
            )}>
              {isCredit ? "+" : ""}{fmt(isCredit ? netBalance.abs().toString() : netBalance.toString())}
            </p>
          </div>
          <span className={cn(
            "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium",
            isDebt
              ? "border border-destructive/30 bg-destructive/10 text-destructive"
              : isCredit
              ? "border border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
              : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          )}>
            {isDebt ? "Borç" : isCredit ? "Kredi" : "Borç Yok"}
          </span>
        </div>
      </div>

      {/* Monthly breakdown */}
      {invoiceRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Bu daireye ait fatura bulunamadı.</p>
      ) : (
        <div className="space-y-2">
          <h2 className="text-base font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Aylık Detaylar
          </h2>
          <div className="rounded-lg border divide-y">
            {invoiceRows.map((inv: typeof invoiceRows[0]) => {
              const due = new Decimal(inv.totalDue ?? "0");
              const paid = new Decimal(inv.amountPaid ?? "0");
              const monthNet = due.sub(paid);

              return (
                <div key={inv.periodId} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">
                      {MONTHS[inv.periodMonth]} {inv.periodYear}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Borç: {fmt(due.toString())} | Ödenen: {fmt(paid.toString())}
                    </p>
                  </div>
                  <div>
                    {inv.status === "Ödendi" && (
                      <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        Ödendi
                      </span>
                    )}
                    {inv.status === "Fazla Ödendi" && (
                      <span className="inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-600 dark:text-cyan-400">
                        +{fmt(monthNet.abs().toString())} Kredi
                      </span>
                    )}
                    {inv.status === "Ödenmedi" && (
                      <span className="inline-flex items-center rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive">
                        {fmt(monthNet.toString())} Borç
                      </span>
                    )}
                    {inv.status === "Kısmi" && (
                      <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                        {fmt(monthNet.toString())} Kalan
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
