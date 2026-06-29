"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Pencil, Trash2, Plus } from "lucide-react";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  createPreset,
  updatePreset,
  deletePreset,
} from "@/actions/expense-categories";

type Category = { id: number; name: string };
type Preset = { id: number; name: string; defaultAmount: string; categoryId: number; categoryName: string };

function CategoryDialog({
  open,
  onOpenChange,
  category,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  category?: Category;
}) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = category ? await updateCategory(category.id, fd) : await createCategory(fd);
      if (r.error) setError(r.error);
      else onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>{category ? "Kategoriyi Düzenle" : "Kategori Ekle"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Adı</Label>
            <Input id="name" name="name" required defaultValue={category?.name} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Kaydediliyor…" : category ? "Kaydet" : "Ekle"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PresetDialog({
  open,
  onOpenChange,
  preset,
  categories,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  preset?: Preset;
  categories: Category[];
}) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [categoryId, setCategoryId] = useState(preset?.categoryId?.toString() ?? "");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    fd.set("categoryId", categoryId);
    startTransition(async () => {
      const r = preset ? await updatePreset(preset.id, fd) : await createPreset(fd);
      if (r.error) setError(r.error);
      else onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>{preset ? "Şablonu Düzenle" : "Şablon Ekle"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pname">Adı</Label>
            <Input id="pname" name="name" required defaultValue={preset?.name} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Kategori</Label>
            <Select value={categoryId} onValueChange={(v) => { if (v !== null) setCategoryId(v); }}>
              <SelectTrigger>
                <SelectValue placeholder="Seçiniz…">
                  {(val: string) => categories.find(c => c.id.toString() === val)?.name || val}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="defaultAmount">Varsayılan tutar (₺)</Label>
            <Input id="defaultAmount" name="defaultAmount" type="number" step="0.01" required defaultValue={preset?.defaultAmount} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
            <Button type="submit" disabled={isPending || !categoryId}>{isPending ? "Kaydediliyor…" : preset ? "Kaydet" : "Ekle"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CategoriesPanel({
  categories,
  presets,
}: {
  categories: Category[];
  presets: Preset[];
}) {
  const [catDialog, setCatDialog] = useState<{ open: boolean; category?: Category }>({ open: false });
  const [presetDialog, setPresetDialog] = useState<{ open: boolean; preset?: Preset }>({ open: false });
  const [isPending, startTransition] = useTransition();

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      {/* Categories */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-medium">Kategoriler</h2>
          <Button size="sm" variant="outline" onClick={() => setCatDialog({ open: true })}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Ekle
          </Button>
        </div>
        <div className="rounded-lg border divide-y">
          {categories.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Henüz kategori yok.</p>
          )}
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm">{cat.name}</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCatDialog({ open: true, category: cat })}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" disabled={isPending} onClick={() => { if (confirm("Kategoriyi silmek istediğinize emin misiniz?")) startTransition(() => { void deleteCategory(cat.id); }); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Presets */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-medium">Gider şablonları</h2>
          <Button size="sm" variant="outline" onClick={() => setPresetDialog({ open: true })} disabled={categories.length === 0}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Ekle
          </Button>
        </div>
        <div className="rounded-lg border divide-y">
          {presets.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Henüz şablon yok.</p>
          )}
          {presets.map((preset) => (
            <div key={preset.id} className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-sm">{preset.name}</span>
                <Badge variant="outline" className="text-xs">{preset.categoryName}</Badge>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium tabular-nums">₺{Number(preset.defaultAmount).toLocaleString("tr-TR")}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPresetDialog({ open: true, preset })}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" disabled={isPending} onClick={() => { if (confirm("Şablonu silmek istediğinize emin misiniz?")) startTransition(() => { void deletePreset(preset.id); }); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <CategoryDialog open={catDialog.open} onOpenChange={(open) => setCatDialog({ open })} category={catDialog.category} />
      <PresetDialog open={presetDialog.open} onOpenChange={(open) => setPresetDialog({ open })} preset={presetDialog.preset} categories={categories} />
    </div>
  );
}
