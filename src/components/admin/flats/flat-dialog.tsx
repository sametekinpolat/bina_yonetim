"use client";

import { useState, useTransition } from "react";
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
import { createFlat, updateFlat } from "@/actions/flats";

type Flat = {
  id: number;
  flatNumber: number;
  sizeSqm: string | null;
  waterTier: "Tam" | "Düşük" | "Yok";
};

interface FlatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flat?: Flat;
}

export function FlatDialog({ open, onOpenChange, flat }: FlatDialogProps) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [waterTier, setWaterTier] = useState<string>(flat?.waterTier ?? "Tam");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);
    formData.set("waterTier", waterTier);

    startTransition(async () => {
      const result = flat
        ? await updateFlat(flat.id, formData)
        : await createFlat(formData);

      if (result.error) {
        setError(result.error);
      } else {
        onOpenChange(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{flat ? "Daireyi Düzenle" : "Daire Ekle"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="flatNumber">Daire No</Label>
              <Input
                id="flatNumber"
                name="flatNumber"
                type="number"
                defaultValue={flat?.flatNumber}
                required
                min={1}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sizeSqm">Boyut (m²)</Label>
              <Input
                id="sizeSqm"
                name="sizeSqm"
                type="number"
                step="0.01"
                defaultValue={flat?.sizeSqm ?? ""}
                placeholder="isteğe bağlı"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Su Tarifesi</Label>
            <Select value={waterTier} onValueChange={(v) => { if (v !== null) setWaterTier(v); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Tam">Tam — normal sıcak su</SelectItem>
                <SelectItem value="Düşük">Düşük — azaltılmış kullanım</SelectItem>
                <SelectItem value="Yok">Yok — sıcak su kullanılmıyor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              İptal
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Kaydediliyor…" : flat ? "Değişiklikleri Kaydet" : "Daire Ekle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
