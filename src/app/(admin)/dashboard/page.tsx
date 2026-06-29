import { db } from "@/lib/db";
import {
  accounts, transactions, billingPeriods, monthlyInvoices, bankStatementImports,
} from "@/lib/db/schema";
import { eq, sql, desc, count } from "drizzle-orm";
import Decimal from "decimal.js";
import {
  Landmark, Wallet, TrendingUp, AlertCircle, CheckCircle2, Clock, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

function fmt(val: string | number | null | undefined) {
  const n = Number(val ?? 0);
  return `₺${n.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`;
}

function StatCard({
  label, value, sub, icon: Icon, variant = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  variant?: "default" | "positive" | "warning" | "danger";
}) {
  const colorMap = {
    default: "text-foreground",
    positive: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-destructive",
  };
  return (
    <div className="rounded-lg border bg-card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className={`text-2xl font-bold tabular-nums ${colorMap[variant]}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default async function DashboardPage() {
  // Account balances
  const accountRows = await db
    .select({
      id: accounts.id,
      accountName: accounts.accountName,
      accountType: accounts.accountType,
      balance: sql<string>`
        COALESCE(SUM(
          CASE WHEN ${transactions.transactionType} = 'Gelir'
               THEN ${transactions.amount}::numeric
               ELSE -${transactions.amount}::numeric END
        ), 0)
      `.as("balance"),
    })
    .from(accounts)
    .leftJoin(transactions, eq(transactions.accountId, accounts.id))
    .groupBy(accounts.id)
    .orderBy(accounts.accountName);

  const totalBalance = accountRows.reduce(
    (acc, r) => acc.add(new Decimal(r.balance)),
    new Decimal(0)
  );

  // Latest published period
  const [latestPeriod] = await db
    .select()
    .from(billingPeriods)
    .where(eq(billingPeriods.status, "Yayınlandı"))
    .orderBy(desc(billingPeriods.periodYear), desc(billingPeriods.periodMonth))
    .limit(1);

  let periodStats: {
    totalInvoiced: Decimal;
    totalCollected: Decimal;
    outstanding: Decimal;
    paidCount: number;
    unpaidCount: number;
  } | null = null;

  if (latestPeriod) {
    const invRows = await db
      .select({
        totalDue: monthlyInvoices.totalDue,
        amountPaid: monthlyInvoices.amountPaid,
        status: monthlyInvoices.status,
      })
      .from(monthlyInvoices)
      .where(eq(monthlyInvoices.periodId, latestPeriod.id));

    const totalInvoiced = invRows.reduce(
      (a, r) => a.add(new Decimal(r.totalDue)), new Decimal(0)
    );
    const totalCollected = invRows.reduce(
      (a, r) => a.add(new Decimal(r.amountPaid ?? "0")), new Decimal(0)
    );
    periodStats = {
      totalInvoiced,
      totalCollected,
      outstanding: totalInvoiced.sub(totalCollected),
      paidCount: invRows.filter((r) => r.status === "Ödendi").length,
      unpaidCount: invRows.filter((r) => r.status === "Ödenmedi" || r.status === "Kısmi").length,
    };
  }

  // Pending bank imports
  const [{ pendingImports }] = await db
    .select({ pendingImports: count() })
    .from(bankStatementImports)
    .where(eq(bankStatementImports.status, "Bekliyor"));

  // Recent transactions
  const recentTxs = await db
    .select({
      id: transactions.id,
      accountName: accounts.accountName,
      transactionType: transactions.transactionType,
      amount: transactions.amount,
      transactionDate: transactions.transactionDate,
    })
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .orderBy(desc(transactions.transactionDate), desc(transactions.id))
    .limit(7);

  // All billing periods summary
  const allPeriods = await db
    .select({
      id: billingPeriods.id,
      periodName: billingPeriods.periodName,
      status: billingPeriods.status,
    })
    .from(billingPeriods)
    .orderBy(desc(billingPeriods.periodYear), desc(billingPeriods.periodMonth))
    .limit(5);

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Panel</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bina özeti ve finansal durum
        </p>
      </div>

      {/* Top KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Toplam kasa ve banka"
          value={fmt(totalBalance.toString())}
          icon={Landmark}
          variant={totalBalance.isNegative() ? "danger" : "positive"}
        />
        {periodStats && latestPeriod ? (
          <>
            <StatCard
              label={`${latestPeriod.periodName} — tahakkuk eden`}
              value={fmt(periodStats.totalInvoiced.toString())}
              sub={`${periodStats.paidCount} ödendi / ${periodStats.unpaidCount} ödenmedi`}
              icon={TrendingUp}
            />
            <StatCard
              label={`${latestPeriod.periodName} — tahsil edilen`}
              value={fmt(periodStats.totalCollected.toString())}
              icon={CheckCircle2}
              variant="positive"
            />
            <StatCard
              label={`${latestPeriod.periodName} — kalan`}
              value={fmt(periodStats.outstanding.toString())}
              icon={AlertCircle}
              variant={periodStats.outstanding.isZero() ? "positive" : "warning"}
            />
          </>
        ) : (
          <StatCard
            label="Mevcut dönem"
            value="—"
            sub="Henüz yayınlanmış bir dönem yok"
            icon={Clock}
          />
        )}
      </div>

      {/* Account balances + Pending imports */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Account cards */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-base font-medium">Hesap bakiyeleri</h2>
          {accountRows.length === 0 && (
            <p className="text-sm text-muted-foreground">Henüz hesap oluşturulmamış.</p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {accountRows.map((acc) => (
              <div key={acc.id} className="flex items-center gap-3 rounded-lg border p-4">
                {acc.accountType === "Banka"
                  ? <Landmark className="h-5 w-5 text-muted-foreground shrink-0" />
                  : <Wallet className="h-5 w-5 text-muted-foreground shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{acc.accountName}</p>
                  <p className="text-xs text-muted-foreground">{acc.accountType}</p>
                </div>
                <p className={`tabular-nums font-semibold text-sm ${Number(acc.balance) < 0 ? "text-destructive" : ""}`}>
                  {fmt(acc.balance)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick status */}
        <div className="space-y-3">
          <h2 className="text-base font-medium">Hızlı durum</h2>
          <div className="rounded-lg border divide-y">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm">Bekleyen banka işlemleri</span>
              {Number(pendingImports) > 0
                ? <Badge variant="destructive">{pendingImports}</Badge>
                : <Badge variant="secondary">0</Badge>}
            </div>
            {allPeriods.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <Link href={`/periods/${p.id}`} className="text-sm hover:underline truncate mr-2">
                  {p.periodName}
                </Link>
                <Badge variant={
                  p.status === "Kapandı" ? "secondary" :
                  p.status === "Yayınlandı" ? "default" : "outline"
                }>
                  {p.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium">Son işlemler</h2>
          <Link href="/transactions" className="text-sm text-muted-foreground hover:underline">
            Tümünü gör
          </Link>
        </div>
        {recentTxs.length === 0 && (
          <p className="text-sm text-muted-foreground">Henüz işlem kaydedilmemiş.</p>
        )}
        <div className="rounded-lg border divide-y">
          {recentTxs.map((tx) => (
            <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
              {tx.transactionType === "Gelir"
                ? <ArrowUpRight className="h-4 w-4 text-emerald-600 shrink-0" />
                : <ArrowDownRight className="h-4 w-4 text-destructive shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm">{tx.accountName}</p>
                <p className="text-xs text-muted-foreground">{tx.transactionDate}</p>
              </div>
              <p className={`tabular-nums text-sm font-medium ${tx.transactionType === "Gider" ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
                {tx.transactionType === "Gider" ? "−" : "+"}{fmt(tx.amount)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
