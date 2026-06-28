"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createVendorPayable } from "@/actions/vendor-payables";

interface CreatePayableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: number;
  vendorName: string;
  periodId?: number;
  planExpenseId?: number;
  defaultDescription?: string;
  defaultAmount?: string;
}

export function CreatePayableDialog({
  open,
  onOpenChange,
  vendorId,
  vendorName,
  periodId,
  planExpenseId,
  defaultDescription = "",
  defaultAmount = "",
}: CreatePayableDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    // Inject hidden fields
    data.set("vendorId", vendorId.toString());
    if (periodId) data.set("periodId", periodId.toString());
    if (planExpenseId) data.set("planExpenseId", planExpenseId.toString());

    startTransition(async () => {
      const result = await createVendorPayable(data);
      if (result.error) {
        setError(result.error);
      } else {
        onOpenChange(false);
        form.reset();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Borç Oluştur — {vendorName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cp-description">Açıklama</Label>
            <Input
              id="cp-description"
              name="description"
              placeholder="Asansör bakım faturası"
              defaultValue={defaultDescription}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cp-amount">Fatura Tutarı (₺)</Label>
            <Input
              id="cp-amount"
              name="invoiceAmount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              defaultValue={defaultAmount}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cp-dueDate">Vade Tarihi</Label>
            <Input
              id="cp-dueDate"
              name="dueDate"
              type="date"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cp-notes">Notlar</Label>
            <textarea
              id="cp-notes"
              name="notes"
              placeholder="Opsiyonel notlar…"
              rows={2}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              İptal
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Kaydediliyor…" : "Borç Oluştur"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
