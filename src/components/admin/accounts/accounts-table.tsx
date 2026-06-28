"use client";

import { useState, useTransition } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Pencil, Trash2, Landmark, Wallet } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { AccountDialog } from "./account-dialog";
import { deleteAccount } from "@/actions/accounts";

type Account = {
  id: number;
  accountName: string;
  accountType: "Banka" | "Kasa";
  balance: string;
};

function fmt(val: string) {
  const n = Number(val);
  return `₺${n.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`;
}

export function AccountsTable({ accounts }: { accounts: Account[] }) {
  const [editTarget, setEditTarget] = useState<Account | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <div className="flex items-center justify-between pb-4">
        <p className="text-sm text-muted-foreground">{accounts.length} hesap</p>
        <Button size="sm" onClick={() => { setEditTarget(null); setDialogOpen(true); }}>
          Hesap Ekle
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hesap</TableHead>
              <TableHead>Tür</TableHead>
              <TableHead className="text-right">Bakiye</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  Henüz hesap yok.
                </TableCell>
              </TableRow>
            )}
            {accounts.map((acc) => (
              <TableRow key={acc.id}>
                <TableCell>
                  <div className="flex items-center gap-2 font-medium">
                    {acc.accountType === "Banka"
                      ? <Landmark className="h-4 w-4 text-muted-foreground" />
                      : <Wallet className="h-4 w-4 text-muted-foreground" />}
                    {acc.accountName}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={acc.accountType === "Banka" ? "default" : "secondary"}>
                    {acc.accountType}
                  </Badge>
                </TableCell>
                <TableCell className={`text-right tabular-nums font-semibold ${Number(acc.balance) < 0 ? "text-destructive" : ""}`}>
                  {fmt(acc.balance)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger className={buttonVariants({ variant: "ghost", size: "icon" })}>
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setEditTarget(acc); setDialogOpen(true); }}>
                        <Pencil className="mr-2 h-4 w-4" />Düzenle
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={isPending}
                        onClick={() => { if (confirm("Bu hesabı silmek istediğinize emin misiniz?")) startTransition(() => { void deleteAccount(acc.id); }); }}
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

      <AccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        account={editTarget ?? undefined}
      />
    </>
  );
}
