"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { createPerson, updatePerson } from "@/actions/people";

type Person = {
  id: number;
  firstName: string;
  lastName: string;
  phoneNumber: string | null;
  email: string | null;
};

interface PersonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person?: Person;
}

export function PersonDialog({ open, onOpenChange, person }: PersonDialogProps) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = person
        ? await updatePerson(person.id, formData)
        : await createPerson(formData);
      if (result.error) setError(result.error);
      else onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{person ? "Kişiyi Düzenle" : "Kişi Ekle"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="firstName">Ad</Label>
              <Input id="firstName" name="firstName" required defaultValue={person?.firstName} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lastName">Soyad</Label>
              <Input id="lastName" name="lastName" required defaultValue={person?.lastName} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phoneNumber">Telefon</Label>
            <Input
              id="phoneNumber"
              name="phoneNumber"
              type="tel"
              defaultValue={person?.phoneNumber ?? ""}
              placeholder="isteğe bağlı"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">E-posta</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={person?.email ?? ""}
              placeholder="isteğe bağlı"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              İptal
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Kaydediliyor…" : person ? "Değişiklikleri Kaydet" : "Kişi Ekle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
