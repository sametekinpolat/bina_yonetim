"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { createPeriod } from "@/actions/billing";

const MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i);

interface PeriodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PeriodDialog({ open, onOpenChange }: PeriodDialogProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(currentYear));

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);
    formData.set("periodMonth", month);
    formData.set("periodYear", year);

    startTransition(async () => {
      const result = await createPeriod(formData);
      if (result.error) {
        setError(result.error);
      } else {
        onOpenChange(false);
        router.push(`/periods/${result.id}`);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Yeni Aidat Dönemi</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="periodName">Dönem Adı</Label>
            <Input
              id="periodName"
              name="periodName"
              placeholder="örn. Ocak 2026"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Ay</Label>
              <Select value={month} onValueChange={(v) => { if (v !== null) setMonth(v); }}>
                <SelectTrigger>
                  <SelectValue>
                    {(val: string) => MONTHS[parseInt(val) - 1] || val}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((name, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Yıl</Label>
              <Select value={year} onValueChange={(v) => { if (v !== null) setYear(v); }}>
                <SelectTrigger>
                  <SelectValue>
                    {(val: string) => val}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              İptal
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Oluşturuluyor…" : "Dönem Oluştur"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
