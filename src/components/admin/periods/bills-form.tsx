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
  emptyFlatsPayGas: boolean;
  disabled?: boolean;
}

export function BillsForm({
  periodId,
  rawGasBill,
  rawWaterBill,
  lowDiscountPercent,
  emptyFlatsPayGas,
  disabled,
}: BillsFormProps) {
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [payGas, setPayGas] = useState(emptyFlatsPayGas);
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
      <div className="flex items-center gap-3 mt-4 mb-2">
        <Label className={`text-sm ${disabled ? "opacity-50" : ""}`}>
          Boş Daireler Doğalgaz Ödeyecek Mi?
        </Label>
        <button
          type="button"
          role="switch"
          aria-checked={payGas}
          disabled={disabled}
          onClick={() => setPayGas(!payGas)}
          className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 shadow-inner ${
            payGas ? "bg-green-500" : "bg-red-500"
          } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <span className="sr-only">Toggle empty flats pay gas</span>
          <span
            className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
              payGas ? "translate-x-9" : "translate-x-1"
            }`}
          />
          <span
            className={`absolute text-[10px] font-bold text-white uppercase pointer-events-none transition-all ${
              payGas ? "left-2" : "right-1.5"
            }`}
          >
            {payGas ? "Evet" : "Hayır"}
          </span>
        </button>
        <input type="hidden" name="emptyFlatsPayGas" value={payGas ? "true" : "false"} />
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
