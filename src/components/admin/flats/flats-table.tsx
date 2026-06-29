"use client";

import { useState, useTransition } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FlatDialog } from "./flat-dialog";
import { deleteFlat } from "@/actions/flats";
import { buttonVariants } from "@/components/ui/button";

const waterVariants: Record<string, "default" | "secondary" | "outline"> = {
  "Tam": "default",
  "Düşük": "secondary",
  "Yok": "outline",
};

type Flat = {
  id: number;
  flatNumber: number;
  sizeSqm: string | null;
  waterTier: "Tam" | "Düşük" | "Yok";
  residents: { name: string; role: string }[];
};

export function FlatsTable({ flats }: { flats: Flat[] }) {
  const [editTarget, setEditTarget] = useState<Flat | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function openAdd() {
    setEditTarget(null);
    setDialogOpen(true);
  }

  function openEdit(flat: Flat) {
    setEditTarget(flat);
    setDialogOpen(true);
  }

  function handleDelete(id: number) {
    if (!confirm("Bu daireyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.")) return;
    startTransition(() => { void deleteFlat(id); });
  }

  return (
    <>
      <div className="flex items-center justify-between pb-4">
        <p className="text-sm text-muted-foreground">{flats.length} daire</p>
        <Button size="sm" onClick={openAdd}>Daire Ekle</Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Daire No</TableHead>
              <TableHead className="w-24">Boyut (m²)</TableHead>
              <TableHead className="w-24">Su Tarifesi</TableHead>
              <TableHead>Mevcut Sakinler</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {flats.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Henüz daire yok.
                </TableCell>
              </TableRow>
            )}
            {flats.map((flat) => (
              <TableRow key={flat.id}>
                <TableCell className="font-medium">{flat.flatNumber}</TableCell>
                <TableCell>{flat.sizeSqm ? `${flat.sizeSqm} m²` : "—"}</TableCell>
                <TableCell>
                  <Badge variant={waterVariants[flat.waterTier]}>
                    {flat.waterTier}
                  </Badge>
                </TableCell>
                <TableCell>
                  {flat.residents.length === 0 ? (
                    <span className="text-muted-foreground text-sm">Boş</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {flat.residents.map((r, i) => (
                        <Badge key={i} variant="secondary">
                          {r.name} · {r.role}
                        </Badge>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger className={buttonVariants({ variant: "ghost", size: "icon" })}>
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(flat)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Düzenle
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        disabled={isPending}
                        onClick={() => handleDelete(flat.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Sil
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <FlatDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        flat={editTarget ?? undefined}
      />
    </>
  );
}
