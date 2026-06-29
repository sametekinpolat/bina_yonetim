import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import {
  billingPeriods,
  monthlyInvoices,
  flats,
  periodPlanExpenses,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  CheckCircle2,
  ChevronLeft,
  Circle,
  FileText,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const MONTHS_TR = [
  "", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

const statusVariants: Record<string, "default" | "secondary" | "outline"> = {
  "Taslak": "outline",
  "Yayınlandı": "default",
  "Kapandı": "secondary",
};

function fmt(val: string | null | undefined) {
  const n = Number(val ?? 0);
  return `₺${n.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`;
}

function fmtNum(val: number) {
  return `₺${val.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`;
}

export default async function GuestPeriodPage({
  params,
}: {
  params: Promise<{ period_id: string }>;
}) {
  const { period_id } = await params;
  const id = parseInt(period_id);
  if (isNaN(id)) notFound();

  const [period] = await db
    .select()
    .from(billingPeriods)
    .where(eq(billingPeriods.id, id))
    .limit(1);

  if (!period || period.status === "Taslak") notFound();

  const [invoices, expenses] = await Promise.all([
    db
      .select({
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
      .select()
      .from(periodPlanExpenses)
      .where(eq(periodPlanExpenses.periodId, id))
      .orderBy(periodPlanExpenses.sortOrder),
  ]);

  const totalExpenses = Number(period.rawDuesPlanned ?? 0);
  const totalCollected = invoices.reduce(
    (sum, inv) => sum + Number(inv.amountPaid ?? 0),
    0
  );
  const balance = totalCollected - totalExpenses;

  const colTotals = invoices.reduce(
    (acc, inv) => ({
      water: acc.water + Number(inv.waterFee ?? 0),
      gas: acc.gas + Number(inv.gasFee ?? 0),
      dues: acc.dues + Number(inv.otherFee ?? 0),
      total: acc.total + Number(inv.totalDue ?? 0),
      remaining:
        acc.remaining +
        Math.max(0, Number(inv.totalDue ?? 0) - Number(inv.amountPaid ?? 0)),
    }),
    { water: 0, gas: 0, dues: 0, total: 0, remaining: 0 }
  );

  const paidCount = invoices.filter(
    (inv) => inv.status === "Ödendi" || inv.status === "Fazla Ödendi"
  ).length;

  const expensesTotal = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 space-y-6">
        {/* Back + print */}
        <div className="flex items-center justify-between">
          <Link
            href="/p"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Aylık Ödeme Kayıtları
          </Link>
          <a
            href={`/api/reports/period/${id}/pdf`}
            download
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <FileText className="mr-1.5 h-3.5 w-3.5" />
            PDF İndir
          </a>
        </div>

        {/* Page title */}
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{period.periodName}</h1>
          <Badge variant={statusVariants[period.status ?? "Taslak"]}>
            {period.status}
          </Badge>
        </div>

        {/* <Separator /> */}

        {/* Özet — 3 stat cards matching dashboard pattern */}
{/*         <section className="space-y-3">
          <h2 className="text-base font-medium">Özet</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border bg-card p-5 flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">Toplam Gider</p>
              <p className="text-2xl font-bold tabular-nums">{fmtNum(totalExpenses)}</p>
            </div>
            <div className="rounded-lg border bg-card p-5 flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">Toplanan</p>
              <p className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {fmtNum(totalCollected)}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-5 flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">Kasaya Kalan</p>
              <p
                className={`text-2xl font-bold tabular-nums ${
                  balance >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-destructive"
                }`}
              >
                {fmtNum(balance)}
              </p>
            </div>
          </div>
        </section> */}

        {/* <Separator /> */}

        {/* Özet */}
        {(period.distributedWater || period.distributedGas || period.distributedDues) && (
          <section className="space-y-3">
            <h2 className="text-base font-medium">Özet</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Sıcak Su</p>
                <p className="mt-1 text-sm font-semibold tabular-nums">
                  {fmt(period.distributedWater)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Doğalgaz</p>
                <p className="mt-1 text-sm font-semibold tabular-nums">
                  {fmt(period.distributedGas)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Aidat</p>
                <p className="mt-1 text-sm font-semibold tabular-nums">
                  {fmt(period.distributedDues)}
                </p>
              </div>
            </div>
          </section>
        )}

        {expenses.length > 0 && <Separator />}

        {/* Aidat Detayı */}
        {expenses.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-base font-medium">Aidat Detayı</h2>
            <Card>
              <CardContent className="pt-0 pb-0">
                <div className="divide-y">
                  {expenses.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between py-3 text-sm"
                    >
                      <span className="text-muted-foreground">{e.description}</span>
                      <span className="font-medium tabular-nums">{fmt(e.amount)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between py-3 text-sm font-semibold">
                    <span>Toplam</span>
                    <span className="tabular-nums">{fmtNum(expensesTotal)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        <Separator />

        {/* Daire Detayları */}
        {invoices.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-base font-medium">
              Daire Detayları{" "}
              <span className="text-muted-foreground font-normal text-sm">
                ({paidCount}/{invoices.length} ödendi)
              </span>
            </h2>

            {/* Desktop table */}
            <Card className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Daire</TableHead>
                    <TableHead className="text-right">Su</TableHead>
                    <TableHead className="text-right">Gaz</TableHead>
                    <TableHead className="text-right">Aidat</TableHead>
                    <TableHead className="text-right">Toplam</TableHead>
                    <TableHead className="text-right">Kalan</TableHead>
                    <TableHead className="text-center">Durum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => {
                    const remaining = Math.max(
                      0,
                      Number(inv.totalDue) - Number(inv.amountPaid ?? 0)
                    );
                    const isPaid =
                      inv.status === "Ödendi" || inv.status === "Fazla Ödendi";
                    return (
                      <TableRow key={inv.flatNumber}>
                        <TableCell className="font-medium">{inv.flatNumber}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {fmt(inv.waterFee)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {fmt(inv.gasFee)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {fmt(inv.otherFee)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {fmt(inv.totalDue)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <span
                            className={
                              remaining > 0
                                ? "font-semibold text-destructive"
                                : "text-emerald-600 dark:text-emerald-400"
                            }
                          >
                            {fmtNum(remaining)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {isPaid ? (
                            <CheckCircle2 className="inline h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Circle className="inline h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-semibold">Toplam</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {fmtNum(colTotals.water)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {fmtNum(colTotals.gas)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {fmtNum(colTotals.dues)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {fmtNum(colTotals.total)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-destructive">
                      {fmtNum(colTotals.remaining)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">
                        {paidCount}/{invoices.length}
                      </Badge>
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </Card>

            {/* Mobile accordion — uses native <details> (no JS) */}
            <div className="space-y-2 sm:hidden">
              {invoices.map((inv) => {
                const remaining = Math.max(
                  0,
                  Number(inv.totalDue) - Number(inv.amountPaid ?? 0)
                );
                const isPaid =
                  inv.status === "Ödendi" || inv.status === "Fazla Ödendi";
                return (
                  <details
                    key={inv.flatNumber}
                    className="rounded-xl ring-1 ring-foreground/10 bg-card overflow-hidden"
                  >
                    <summary className="flex cursor-pointer select-none items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
                      <span className="text-sm font-medium">
                        Daire {inv.flatNumber}
                      </span>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="tabular-nums font-semibold">
                          {fmt(inv.totalDue)}
                        </span>
                        {isPaid ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </summary>
                    <div className="border-t divide-y px-4 text-sm bg-muted/20">
                      {(
                        [
                          ["Sıcak Su", fmt(inv.waterFee)],
                          ["Doğalgaz", fmt(inv.gasFee)],
                          ["Aidat", fmt(inv.otherFee)],
                          ["Toplam Borç", fmt(inv.totalDue)],
                        ] as [string, string][]
                      ).map(([label, value]) => (
                        <div
                          key={label}
                          className="flex justify-between py-2.5"
                        >
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-medium tabular-nums">{value}</span>
                        </div>
                      ))}
                      <div className="flex justify-between py-2.5">
                        <span className="text-muted-foreground">Kalan</span>
                        <span
                          className={`font-semibold tabular-nums ${
                            remaining > 0
                              ? "text-destructive"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {fmtNum(remaining)}
                        </span>
                      </div>
                      <div className="flex justify-between py-2.5">
                        <span className="text-muted-foreground">Durum</span>
                        <span
                          className={
                            isPaid
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-muted-foreground"
                          }
                        >
                          {isPaid ? "✓ Ödendi" : "Bekliyor"}
                        </span>
                      </div>
                    </div>
                  </details>
                );
              })}

              {/* Mobile totals */}
              <div className="rounded-xl ring-1 ring-foreground/10 bg-card px-4 py-3 space-y-2 text-sm">
                {(
                  [
                    ["Toplam Su", fmtNum(colTotals.water)],
                    ["Toplam Gaz", fmtNum(colTotals.gas)],
                    ["Toplam Aidat", fmtNum(colTotals.dues)],
                  ] as [string, string][]
                ).map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium tabular-nums">{value}</span>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Genel Toplam</span>
                  <span className="tabular-nums">{fmtNum(colTotals.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Kalan</span>
                  <span className="font-semibold tabular-nums text-destructive">
                    {fmtNum(colTotals.remaining)}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Ödeme Durumu</span>
                  <span>{paidCount}/{invoices.length} Ödendi</span>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                Ödendi
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Circle className="h-3.5 w-3.5" />
                Bekliyor
              </span>
            </div>
          </section>
        )}

        <Separator />

        <p className="text-center text-xs text-muted-foreground pb-4">
          Bu sayfa salt okunurdur. Ödeme sorularınız için yönetici ile iletişime geçin.
        </p>
    </main>
  );
}
