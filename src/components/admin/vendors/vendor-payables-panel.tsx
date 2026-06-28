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
import { Trash2, PlusCircle } from "lucide-react";
import { deleteVendorPayable } from "@/actions/vendor-payables";
import { CreatePayableDialog } from "./create-payable-dialog";
import Decimal from "decimal.js";

type PayableRow = {
  id: number;
  description: string;
  invoiceAmount: string;
  amountPaid: string;
  dueDate: string | null;
  paymentStatus: string;
  notes: string | null;
  periodId: number | null;
  planExpenseId: number | null;
  createdAt: string | null;
};

type Vendor = {
  id: number;
  name: string;
};

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  "Ödenmedi": "destructive",
  "Kısmi": "outline",
  "Ödendi": "secondary",
  "Fazla Ödendi": "default",
};

function fmt(val: string) {
  return `₺${Number(val).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`;
}

export function VendorPayablesPanel({
  vendor,
  payables: initialPayables,
}: {
  vendor: Vendor;
  payables: PayableRow[];
}) {
  const [payables, setPayables] = useState<PayableRow[]>(initialPayables);
  const [createOpen, setCreateOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Balance = sum of (invoiceAmount - amountPaid) for all payables
  const balance = payables.reduce((acc, p) => {
    return acc.add(new Decimal(p.invoiceAmount).minus(new Decimal(p.amountPaid)));
  }, new Decimal(0));

  const balanceNum = balance.toNumber();

  function handleDelete(id: number) {
    if (!confirm("Bu borcu silmek istediğinizden emin misiniz?")) return;
    startTransition(async () => {
      const result = await deleteVendorPayable(id);
      if (result.success) {
        setPayables((prev) => prev.filter((p) => p.id !== id));
      } else {
        alert(result.error);
      }
    });
  }

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
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
          Borç Ekle
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Açıklama</TableHead>
              <TableHead className="text-right">Fatura</TableHead>
              <TableHead className="text-right">Ödenen</TableHead>
              <TableHead className="text-right">Kalan</TableHead>
              <TableHead>Vade</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {payables.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Bu firma için kayıtlı borç yok.
                </TableCell>
              </TableRow>
            )}
            {payables.map((p) => {
              const remaining = new Decimal(p.invoiceAmount).minus(new Decimal(p.amountPaid));
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    {p.description}
                    {p.notes && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-48">
                        {p.notes}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(p.invoiceAmount)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(p.amountPaid)}</TableCell>
                  <TableCell
                    className={`text-right tabular-nums font-medium ${
                      remaining.lt(0)
                        ? "text-emerald-600 dark:text-emerald-400"
                        : remaining.gt(0)
                        ? "text-destructive"
                        : ""
                    }`}
                  >
                    {remaining.lt(0) ? `+${fmt(remaining.abs().toFixed(2))} alacak` : fmt(remaining.toFixed(2))}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.dueDate ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariants[p.paymentStatus] ?? "outline"}>
                      {p.paymentStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      disabled={isPending}
                      onClick={() => handleDelete(p.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <CreatePayableDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        vendorId={vendor.id}
        vendorName={vendor.name}
      />
    </div>
  );
}
