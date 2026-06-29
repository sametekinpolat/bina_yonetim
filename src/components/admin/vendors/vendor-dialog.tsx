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
import { createVendor, updateVendor } from "@/actions/vendors";

type Vendor = {
  id: number;
  name: string;
  vendorType: "Şirket" | "Personel" | "Kamu";
  contactInfo: string | null;
  iban: string | null;
};

interface VendorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor?: Vendor;
}

export function VendorDialog({ open, onOpenChange, vendor }: VendorDialogProps) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [vendorType, setVendorType] = useState<string>(vendor?.vendorType ?? "Şirket");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);
    formData.set("vendorType", vendorType);
    startTransition(async () => {
      const result = vendor
        ? await updateVendor(vendor.id, formData)
        : await createVendor(formData);
      if (result.error) setError(result.error);
      else onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{vendor ? "Firmayı Düzenle" : "Firma Ekle"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Adı</Label>
            <Input id="name" name="name" required defaultValue={vendor?.name} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Tür</Label>
            <Select value={vendorType} onValueChange={(v) => { if (v !== null) setVendorType(v); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Şirket">Şirket</SelectItem>
                <SelectItem value="Personel">Personel</SelectItem>
                <SelectItem value="Kamu">Kamu Kurumu</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contactInfo">İletişim Bilgileri</Label>
            <Input
              id="contactInfo"
              name="contactInfo"
              defaultValue={vendor?.contactInfo ?? ""}
              placeholder="Telefon, e-posta, adres… (isteğe bağlı)"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="iban">IBAN</Label>
            <Input
              id="iban"
              name="iban"
              defaultValue={vendor?.iban ?? ""}
              placeholder="isteğe bağlı"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              İptal
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Kaydediliyor…" : vendor ? "Değişiklikleri Kaydet" : "Firma Ekle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
