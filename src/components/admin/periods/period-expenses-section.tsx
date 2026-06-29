"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Building2, CheckCircle2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addPeriodExpense,
  removePeriodExpense,
  updatePeriodExpense,
} from "@/actions/period-expenses";
import { CreatePayableDialog } from "@/components/admin/vendors/create-payable-dialog";
import Decimal from "decimal.js";

interface Preset {
  id: number;
  name: string;
  defaultAmount: string;
  vendorId?: number | null;
}

interface Vendor {
  id: number;
  name: string;
}

interface ExpenseItem {
  id: number;
  description: string;
  amount: string;
  presetId: number | null;
  vendorId: number | null;
  hasPayable?: boolean;
}

interface PeriodExpensesSectionProps {
  periodId: number;
  presets: Preset[];
  items: ExpenseItem[];
  vendors: Vendor[];
  disabled?: boolean;
}

function fmt(amount: string) {
  return `₺${Number(amount).toLocaleString("tr-TR")}`;
}

const NO_VENDOR = "__none__";

export function PeriodExpensesSection({
  periodId,
  presets,
  items: initialItems,
  vendors,
  disabled,
}: PeriodExpensesSectionProps) {
  const [items, setItems] = useState<ExpenseItem[]>(initialItems);
  const [isPending, startTransition] = useTransition();

  // New row state
  const [newDesc, setNewDesc] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newVendorId, setNewVendorId] = useState<string>(NO_VENDOR);

  // Payable dialog state
  const [payableTarget, setPayableTarget] = useState<ExpenseItem | null>(null);

  const total = items.reduce(
    (sum, item) => sum.add(new Decimal(item.amount || "0")),
    new Decimal(0),
  );

  function addPreset(preset: Preset) {
    if (disabled) return;
    startTransition(async () => {
      const result = await addPeriodExpense(
        periodId,
        preset.name,
        parseFloat(preset.defaultAmount),
        preset.id,
        preset.vendorId ?? null,
      );
      if (result.success && result.id) {
        setItems((prev) => [
          ...prev,
          {
            id: result.id!,
            description: preset.name,
            amount: preset.defaultAmount,
            presetId: preset.id,
            vendorId: preset.vendorId ?? null,
          },
        ]);
      }
    });
  }

  function addCustom() {
    if (!newDesc.trim() || !newAmount) return;
    const amount = parseFloat(newAmount);
    if (isNaN(amount) || amount < 0) return;
    const vendorId = newVendorId !== NO_VENDOR ? parseInt(newVendorId) : null;
    startTransition(async () => {
      const result = await addPeriodExpense(periodId, newDesc.trim(), amount, undefined, vendorId);
      if (result.success && result.id) {
        setItems((prev) => [
          ...prev,
          {
            id: result.id!,
            description: newDesc.trim(),
            amount: amount.toString(),
            presetId: null,
            vendorId,
          },
        ]);
        setNewDesc("");
        setNewAmount("");
        setNewVendorId(NO_VENDOR);
      }
    });
  }

  function removeItem(id: number) {
    startTransition(async () => {
      await removePeriodExpense(id, periodId);
      setItems((prev) => prev.filter((i) => i.id !== id));
    });
  }

  function updateDesc(id: number, value: string) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, description: value } : i)),
    );
  }

  function updateAmount(id: number, value: string) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, amount: value } : i)),
    );
  }

  function updateItemVendor(id: number, vendorId: number | null) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, vendorId } : i)),
    );
    // Persist immediately
    const item = items.find((i) => i.id === id);
    if (!item) return;
    startTransition(async () => {
      await updatePeriodExpense(id, periodId, item.description, parseFloat(item.amount) || 0, vendorId);
    });
  }

  function saveItem(item: ExpenseItem) {
    startTransition(async () => {
      await updatePeriodExpense(
        item.id,
        periodId,
        item.description,
        parseFloat(item.amount) || 0,
        item.vendorId,
      );
    });
  }

  function openPayableDialog(item: ExpenseItem) {
    setPayableTarget(item);
  }

  const vendorMap = new Map(vendors.map((v) => [v.id, v]));

  return (
    <div className="flex flex-col gap-4">
      {/* Preset buttons */}
      {!disabled && presets.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">Hızlı ekle:</p>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <Button
                key={p.id}
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => addPreset(p)}
              >
                {p.name} ({fmt(p.defaultAmount)})
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Expense list */}
      <div className="flex flex-col gap-2">
        {items.map((item) => {
          const vendor = item.vendorId ? vendorMap.get(item.vendorId) : null;
          return (
            <div key={item.id} className="flex flex-col gap-2 p-3 rounded-md border border-border bg-card">
              <Input
                className="w-full h-8 text-sm font-medium"
                value={item.description}
                placeholder="Açıklama"
                disabled={disabled}
                onChange={(e) => updateDesc(item.id, e.target.value)}
                onBlur={() => !disabled && saveItem(item)}
              />
              <div className="flex items-center gap-2">
                <Input
                  className="w-28 h-8 text-sm text-right font-medium"
                  type="number"
                  step="1"
                  min="0"
                  value={item.amount}
                  placeholder="0"
                  disabled={disabled}
                  onChange={(e) => updateAmount(item.id, e.target.value)}
                  onBlur={() => !disabled && saveItem(item)}
                />
                {/* Vendor selector */}
                {!disabled && (
                  <Select
                    value={item.vendorId?.toString() ?? NO_VENDOR}
                    onValueChange={(v) =>
                      updateItemVendor(item.id, v && v !== NO_VENDOR ? parseInt(v) : null)
                    }
                  >
                    <SelectTrigger className="w-40 h-8 text-xs">
                      <Building2 className="h-3 w-3 mr-1 opacity-50 shrink-0" />
                      <SelectValue placeholder="Firma seç…">
                        {(val: string) =>
                          val === NO_VENDOR
                            ? "— Firma yok —"
                            : vendors.find((v) => v.id.toString() === val)?.name || val
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_VENDOR}>— Firma yok —</SelectItem>
                      {vendors.map((v) => (
                        <SelectItem key={v.id} value={v.id.toString()}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {disabled && vendor && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1 w-40">
                    <Building2 className="h-3 w-3" /> {vendor.name}
                  </span>
                )}

                {/* Create payable button — only shown when a vendor is linked */}
                {!disabled && item.vendorId && (
                  <Button
                    type="button"
                    size="sm"
                    variant={item.hasPayable ? "secondary" : "outline"}
                    className="h-8 text-xs px-2 whitespace-nowrap"
                    onClick={() => openPayableDialog(item)}
                    title="Borç kaydı oluştur"
                  >
                    {item.hasPayable ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
                        Borç ✓
                      </>
                    ) : (
                      "+ Borç"
                    )}
                  </Button>
                )}

                <div className="flex-1" />

                {!disabled && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    disabled={isPending}
                    onClick={() => removeItem(item.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add new row */}
      {!disabled && (
        <div className="flex flex-col gap-2 p-3 rounded-md border border-dashed border-border bg-muted/30">
          <Input
            className="w-full h-8 text-sm font-medium"
            placeholder="Yeni Gider Açıklaması"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustom()}
          />
          <div className="flex items-center gap-2">
            <Input
              className="w-28 h-8 text-sm text-right font-medium"
              type="number"
              step="1"
              min="0"
              placeholder="Tutar"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustom()}
            />
            <Select value={newVendorId} onValueChange={(v) => setNewVendorId(v ?? NO_VENDOR)}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <Building2 className="h-3 w-3 mr-1 opacity-50 shrink-0" />
                <SelectValue placeholder="Firma seç…">
                  {(val: string) =>
                    val === NO_VENDOR
                      ? "— Firma yok —"
                      : vendors.find((v) => v.id.toString() === val)?.name || val
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_VENDOR}>— Firma yok —</SelectItem>
                {vendors.map((v) => (
                  <SelectItem key={v.id} value={v.id.toString()}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex-1" />
            <Button
              type="button"
              variant="default"
              size="sm"
              className="h-8"
              disabled={isPending || !newDesc.trim() || !newAmount}
              onClick={addCustom}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Ekle
            </Button>
          </div>
        </div>
      )}

      {/* Total */}
      <div className="flex justify-between items-center pt-2 border-t text-sm font-semibold">
        <span>Toplam Aidat</span>
        <span className="tabular-nums">₺{total.toNumber().toLocaleString("tr-TR")}</span>
      </div>

      {/* Payable creation dialog */}
      {payableTarget && payableTarget.vendorId && (
        <CreatePayableDialog
          open={!!payableTarget}
          onOpenChange={(open) => {
            if (!open) {
              // When dialog closes, mark the expense as having a payable
              setItems((prev) =>
                prev.map((i) =>
                  i.id === payableTarget?.id ? { ...i, hasPayable: true } : i,
                ),
              );
              setPayableTarget(null);
            }
          }}
          vendorId={payableTarget.vendorId}
          vendorName={
            vendorMap.get(payableTarget.vendorId)?.name ?? "Firma"
          }
          periodId={periodId}
          planExpenseId={payableTarget.id}
          defaultDescription={payableTarget.description}
          defaultAmount={payableTarget.amount}
        />
      )}
    </div>
  );
}
