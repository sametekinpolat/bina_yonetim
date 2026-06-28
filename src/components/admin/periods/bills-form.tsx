"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePeriodBills } from "@/actions/billing";

interface BillsFormProps {
  periodId: number;
  rawGasBill: string | null;
  rawWaterBill: string | null;
  lowDiscountPercent: string | null;
  disabled?: boolean;
}

export function BillsForm({
  periodId,
  rawGasBill,
  rawWaterBill,
  lowDiscountPercent,
  disabled,
}: BillsFormProps) {
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaved(false);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updatePeriodBills(periodId, formData);
      if (result.error) setError(result.error);
      else setSaved(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rawGasBill">Doğalgaz (₺)</Label>
          <Input
            id="rawGasBill"
            name="rawGasBill"
            type="number"
            step="1"
            min="0"
            defaultValue={rawGasBill ?? ""}
            placeholder="0"
            disabled={disabled}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rawWaterBill">Sıcak Su (₺)</Label>
          <Input
            id="rawWaterBill"
            name="rawWaterBill"
            type="number"
            step="1"
            min="0"
            defaultValue={rawWaterBill ?? ""}
            placeholder="0"
            disabled={disabled}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lowDiscountPercent">Düşük Kullanım İndirimi (%)</Label>
          <Input
            id="lowDiscountPercent"
            name="lowDiscountPercent"
            type="number"
            step="1"
            min="0"
            max="100"
            defaultValue={lowDiscountPercent ?? "15"}
            placeholder="15"
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">%90 indirim = %10 ödeme</p>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-green-600">Kaydedildi.</p>}
      {!disabled && (
        <div>
          <Button type="submit" variant="outline" size="sm" disabled={isPending}>
            {isPending ? "Kaydediliyor…" : "Kaydet"}
          </Button>
        </div>
      )}
    </form>
  );
}
