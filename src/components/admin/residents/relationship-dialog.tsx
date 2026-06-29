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
import { createRelationship, updateRelationship } from "@/actions/people";

type FlatOption = { id: number; flatNumber: number };
type Relationship = {
  id: number;
  flatId: number;
  role: "Ev Sahibi" | "Kiracı";
  moveInDate: string;
  moveOutDate: string | null;
};

interface RelationshipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personId: number;
  personName: string;
  flats: FlatOption[];
  relationship?: Relationship;
}

export function RelationshipDialog({
  open,
  onOpenChange,
  personId,
  personName,
  flats,
  relationship,
}: RelationshipDialogProps) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [role, setRole] = useState<string>(relationship?.role ?? "Kiracı");
  const [flatId, setFlatId] = useState<string>(relationship?.flatId?.toString() ?? "");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);
    formData.set("role", role);
    formData.set("flatId", flatId);

    startTransition(async () => {
      const result = relationship
        ? await updateRelationship(relationship.id, formData)
        : await createRelationship(personId, formData);
      if (result.error) setError(result.error);
      else onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {relationship ? "Atamayı Düzenle" : `${personName} kişisini daireye ata`}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Daire</Label>
            <Select value={flatId} onValueChange={(v) => { if (v !== null) setFlatId(v); }} required>
              <SelectTrigger>
                <SelectValue placeholder="Daire seç…" />
              </SelectTrigger>
              <SelectContent>
                {flats.map((f) => (
                  <SelectItem key={f.id} value={f.id.toString()}>
                    Daire {f.flatNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Rol</Label>
            <Select value={role} onValueChange={(v) => { if (v !== null) setRole(v); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Ev Sahibi">Ev Sahibi</SelectItem>
                <SelectItem value="Kiracı">Kiracı</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="moveInDate">Giriş tarihi</Label>
              <Input
                id="moveInDate"
                name="moveInDate"
                type="date"
                required
                defaultValue={relationship?.moveInDate ?? ""}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="moveOutDate">Çıkış tarihi</Label>
              <Input
                id="moveOutDate"
                name="moveOutDate"
                type="date"
                defaultValue={relationship?.moveOutDate ?? ""}
                placeholder="isteğe bağlı"
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              İptal
            </Button>
            <Button type="submit" disabled={isPending || !flatId}>
              {isPending ? "Kaydediliyor…" : relationship ? "Değişiklikleri Kaydet" : "Ata"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
