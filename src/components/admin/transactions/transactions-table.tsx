"use client";

import { useState, useTransition } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Trash2 } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TransactionDialog } from "./transaction-dialog";
import { deleteTransaction } from "@/actions/transactions";

type AccountOption = { id: number; accountName: string; accountType: string };
type InvoiceOption = { id: number; label: string };

type Transaction = {
  id: number;
  accountName: string;
  transactionType: string;
  amount: string;
  transactionDate: string;
  description: string | null;
  invoiceLabel: string | null;
};

const TYPE_VARIANTS: Record<string, "default" | "secondary" | "destructive"> = {
  "Gelir": "default",
  "Gider": "destructive",
  "Transfer": "secondary",
};

function fmt(val: string) {
  return `₺${Number(val).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`;
}

export function TransactionsTable({
  transactions, accounts, invoices, vendors,
}: {
  transactions: Transaction[];
  accounts: AccountOption[];
  invoices: InvoiceOption[];
  vendors: { id: number; name: string }[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <div className="flex items-center justify-between pb-4">
        <p className="text-sm text-muted-foreground">{transactions.length} işlem</p>
        <Button size="sm" onClick={() => setDialogOpen(true)}>İşlem Ekle</Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tarih</TableHead>
              <TableHead>Hesap</TableHead>
              <TableHead>Tür</TableHead>
              <TableHead className="text-right">Tutar</TableHead>
              <TableHead>Bağlantılı Fatura</TableHead>
              <TableHead>Açıklama</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Henüz işlem yok.
                </TableCell>
              </TableRow>
            )}
            {transactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell className="tabular-nums">{tx.transactionDate}</TableCell>
                <TableCell>{tx.accountName}</TableCell>
                <TableCell>
                  <Badge variant={TYPE_VARIANTS[tx.transactionType] ?? "outline"}>
                    {tx.transactionType}
                  </Badge>
                </TableCell>
                <TableCell className={`text-right tabular-nums font-medium ${tx.transactionType === "Gider" || (tx.transactionType === "Transfer" && Number(tx.amount) > 0) ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {tx.transactionType === "Gider" || (tx.transactionType === "Transfer" && Number(tx.amount) > 0) ? "−" : "+"}
                  {fmt(Math.abs(Number(tx.amount)).toString())}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {tx.invoiceLabel ?? "—"}
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground" title={tx.description ?? ""}>
                  {tx.description ?? "—"}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger className={buttonVariants({ variant: "ghost", size: "icon" })}>
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={isPending}
                        onClick={() => { if (confirm("Bu işlemi silmek istediğinize emin misiniz?")) startTransition(() => { void deleteTransaction(tx.id); }); }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />Sil
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        accounts={accounts}
        invoices={invoices}
        vendors={vendors}
      />
    </>
  );
}
