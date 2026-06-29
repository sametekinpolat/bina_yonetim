"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2, PlusCircle, CreditCard } from "lucide-react";
import { deleteVendorPayable } from "@/actions/vendor-payables";
import { CreatePayableDialog } from "./create-payable-dialog";
// import { CreatePaymentDialog } from "./create-payment-dialog"; // We will create this later if needed
import Decimal from "decimal.js";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

export type LedgerItem = {
  id: string; // "payable-1" or "payment-1"
  type: "debt" | "payment";
  date: string; // ISO string
  description: string;
  amount: string;
  originalId: number;
};

type Vendor = {
  id: number;
  name: string;
};

function fmt(val: string) {
  return `₺${Number(val).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`;
}

export function VendorLedgerPanel({
  vendor,
  ledger: initialLedger,
}: {
  vendor: Vendor;
  ledger: LedgerItem[];
}) {
  const [ledger, setLedger] = useState<LedgerItem[]>(initialLedger);
  const [createDebtOpen, setCreateDebtOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Balance = sum of debts - sum of payments
  const balance = ledger.reduce((acc, item) => {
    if (item.type === "debt") return acc.add(new Decimal(item.amount));
    if (item.type === "payment") return acc.sub(new Decimal(item.amount));
    return acc;
  }, new Decimal(0));

  const balanceNum = balance.toNumber();

  function handleDeleteDebt(id: number) {
    if (!confirm("Bu borcu silmek istediğinizden emin misiniz? (Ödemeler silinmeyecek)")) return;
    startTransition(async () => {
      const result = await deleteVendorPayable(id);
      if (result.success) {
        setLedger((prev) => prev.filter((p) => !(p.type === "debt" && p.originalId === id)));
      } else {
        alert(result.error);
      }
    });
  }

  // Calculate running balance for each row
  let currentBalance = new Decimal(0);
  const ledgerWithBalance = [...ledger]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((item) => {
      if (item.type === "debt") {
        currentBalance = currentBalance.add(new Decimal(item.amount));
      } else {
        currentBalance = currentBalance.sub(new Decimal(item.amount));
      }
      return { ...item, runningBalance: currentBalance.toNumber() };
    });

  return (
    <div className="space-y-4">
      {/* Balance summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Net Bakiye:</span>
          <span
            className={`text-sm font-semibold tabular-nums ${
              balanceNum > 0
                ? "text-destructive"
                : balanceNum < 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground"
            }`}
          >
            {balanceNum > 0
              ? `Biz ödüyoruz: ${fmt(balance.toFixed(2))}`
              : balanceNum < 0
              ? `Firma bize borçlu: ${fmt(balance.abs().toFixed(2))}`
              : "Bakiye yok"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* <Button size="sm" variant="outline" onClick={() => {}}>
            <CreditCard className="mr-1.5 h-3.5 w-3.5" />
            Ödeme Ekle
          </Button> */}
          <Button size="sm" onClick={() => setCreateDebtOpen(true)}>
            <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
            Borç Ekle
          </Button>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tarih</TableHead>
              <TableHead>Açıklama</TableHead>
              <TableHead>Tip</TableHead>
              <TableHead className="text-right">Tutar</TableHead>
              <TableHead className="text-right">Bakiye</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {ledgerWithBalance.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Bu firma için kayıtlı işlem yok.
                </TableCell>
              </TableRow>
            )}
            {ledgerWithBalance.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                  {format(new Date(item.date), "d MMM yyyy", { locale: tr })}
                </TableCell>
                <TableCell className="font-medium max-w-[300px] truncate" title={item.description}>
                  {item.description}
                </TableCell>
                <TableCell>
                  <Badge variant={item.type === "debt" ? "destructive" : "secondary"}>
                    {item.type === "debt" ? "Borç" : "Ödeme"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <span className={item.type === "debt" ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}>
                    {item.type === "debt" ? "+" : "-"}{fmt(item.amount)}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium text-muted-foreground">
                  {fmt(item.runningBalance.toFixed(2))}
                </TableCell>
                <TableCell>
                  {item.type === "debt" ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      disabled={isPending}
                      onClick={() => handleDeleteDebt(item.originalId)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <CreatePayableDialog
        open={createDebtOpen}
        onOpenChange={setCreateDebtOpen}
        vendorId={vendor.id}
        vendorName={vendor.name}
      />
    </div>
  );
}
