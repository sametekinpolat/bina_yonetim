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
import { createAccount, updateAccount } from "@/actions/accounts";

type Account = { id: number; accountName: string; accountType: "Banka" | "Kasa" };

export function AccountDialog({
  open, onOpenChange, account,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  account?: Account;
}) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [accountType, setAccountType] = useState<string>(account?.accountType ?? "Banka");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    fd.set("accountType", accountType);
    startTransition(async () => {
      const r = account ? await updateAccount(account.id, fd) : await createAccount(fd);
      if (r.error) setError(r.error);
      else onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>{account ? "Hesabı Düzenle" : "Hesap Ekle"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="accountName">Hesap Adı</Label>
            <Input id="accountName" name="accountName" required defaultValue={account?.accountName} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Tür</Label>
            <Select value={accountType} onValueChange={(v) => { if (v) setAccountType(v); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Banka">Banka</SelectItem>
                <SelectItem value="Kasa">Kasa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Kaydediliyor…" : account ? "Kaydet" : "Hesap Ekle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
