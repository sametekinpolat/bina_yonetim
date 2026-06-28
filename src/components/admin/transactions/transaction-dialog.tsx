"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { createTransaction } from "@/actions/transactions";

type AccountOption = { id: number; accountName: string; accountType: string };
type InvoiceOption = { id: number; label: string };



export function TransactionDialog({
  open, onOpenChange, accounts, invoices,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  accounts: AccountOption[];
  invoices: InvoiceOption[];
}) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [accountId, setAccountId] = useState(accounts[0]?.id.toString() ?? "");
  const [txType, setTxType] = useState("Gelir");
  const [invoiceId, setInvoiceId] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    fd.set("accountId", accountId);
    fd.set("transactionType", txType);
    if (invoiceId) fd.set("relatedInvoiceId", invoiceId);

    startTransition(async () => {
      const r = await createTransaction(fd);
      if (r.error) setError(r.error);
      else onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>İşlem Ekle</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Hesap</Label>
            <Select value={accountId} onValueChange={(v) => { if (v) setAccountId(v); }}>
              <SelectTrigger><SelectValue placeholder="Hesap seç…" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id.toString()}>
                    {a.accountName} ({a.accountType})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Tür</Label>
              <Select value={txType} onValueChange={(v) => { if (v) setTxType(v); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Gelir">Gelir</SelectItem>
                  <SelectItem value="Gider">Gider</SelectItem>
                  <SelectItem value="Transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount">Tutar (₺)</Label>
              <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="transactionDate">Tarih</Label>
            <Input
              id="transactionDate"
              name="transactionDate"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Açıklama (isteğe bağlı)</Label>
            <Input id="description" name="description" type="text" placeholder="İşlem detayı..." />
          </div>

          {txType === "Gelir" && invoices.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label>Fatura ile ilişkilendir (isteğe bağlı)</Label>
              <Select value={invoiceId} onValueChange={(v) => { if (v) setInvoiceId(v === "_none" ? "" : v); }}>
                <SelectTrigger><SelectValue placeholder="Fatura seç…" /></SelectTrigger>
                <SelectContent className="w-[400px]">
                  <SelectItem value="_none">— yok —</SelectItem>
                  {invoices.map((inv) => (
                    <SelectItem key={inv.id} value={inv.id.toString()}>{inv.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
            <Button type="submit" disabled={isPending || !accountId}>
              {isPending ? "Kaydediliyor…" : "İşlem Ekle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
