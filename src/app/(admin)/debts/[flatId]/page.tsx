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
        periodType: billingPeriods.periodType,
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

  const monthlyRows = invoiceRows.filter((invoice) => invoice.periodType !== "Ek Dönem");
  const extraRows = invoiceRows.filter((invoice) => invoice.periodType === "Ek Dönem");
  const getBalance = (rows: typeof invoiceRows) => rows.reduce((acc: Decimal, inv: typeof invoiceRows[0]) => {
    const due = new Decimal(inv.totalDue ?? "0");
    const paid = new Decimal(inv.amountPaid ?? "0");
    return acc.add(due).sub(paid);
  }, new Decimal(0));
  const monthlyBalance = getBalance(monthlyRows);
  const balanceCards = [
    { title: "Aylık Aidat Bakiyesi", balance: monthlyBalance },
    ...extraRows.map((invoice) => ({
      title: `${invoice.periodName} Bakiyesi`,
      balance: new Decimal(invoice.totalDue ?? "0").sub(invoice.amountPaid ?? "0"),
    })),
  ];

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

      <div className="grid gap-3 sm:grid-cols-2">
        {balanceCards.map(({ title, balance }) => {
          const isDebt = balance.isPositive();
          const isCredit = balance.isNegative();
          return (
            <div key={title} className="rounded-lg border bg-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{title}</p>
                  <p className={cn(
                    "mt-1 text-2xl font-bold tabular-nums",
                    isDebt ? "text-destructive" : isCredit ? "text-cyan-600 dark:text-cyan-400" : "text-emerald-600 dark:text-emerald-400"
                  )}>
                    {isCredit ? "+" : ""}{fmt(isCredit ? balance.abs().toString() : balance.toString())}
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
          );
        })}
      </div>

      {/* Monthly breakdown */}
      {invoiceRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Bu daireye ait fatura bulunamadı.</p>
      ) : (
        <div className="space-y-2">
          <h2 className="text-base font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Dönem Detayları
          </h2>
          {[
            { title: "Aylık Aidatlar", rows: monthlyRows },
            { title: "Ek Dönem Tahakkukları", rows: extraRows },
          ].filter((group) => group.rows.length > 0).map((group) => (
            <section key={group.title} className="space-y-2 pt-2">
              <h3 className="text-sm font-semibold text-muted-foreground">{group.title}</h3>
              <div className="rounded-lg border divide-y">
                {group.rows.map((inv) => {
                  const due = new Decimal(inv.totalDue ?? "0");
                  const paid = new Decimal(inv.amountPaid ?? "0");
                  const amountLeft = due.sub(paid);
                  return (
                    <div key={inv.periodId} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">{inv.periodName}</p>
                        <p className="text-xs text-muted-foreground">
                          Borç: {fmt(due.toString())} | Ödenen: {fmt(paid.toString())}
                        </p>
                      </div>
                      <div>
                        {inv.status === "Ödendi" && <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">Ödendi</span>}
                        {inv.status === "Fazla Ödendi" && <span className="inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-600 dark:text-cyan-400">+{fmt(amountLeft.abs().toString())} Kredi</span>}
                        {inv.status === "Ödenmedi" && <span className="inline-flex rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive">{fmt(amountLeft.toString())} Borç</span>}
                        {inv.status === "Kısmi" && <span className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">{fmt(amountLeft.toString())} Kalan</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
