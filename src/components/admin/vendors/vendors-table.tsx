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
import { VendorDialog } from "./vendor-dialog";
import { deleteVendor } from "@/actions/vendors";
import { buttonVariants } from "@/components/ui/button";

type Vendor = {
  id: number;
  name: string;
  vendorType: "Şirket" | "Personel" | "Kamu";
  contactInfo: string | null;
  iban: string | null;
};

const TYPE_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  "Şirket": "default",
  "Personel": "secondary",
  "Kamu": "outline",
};

export function VendorsTable({ vendors }: { vendors: Vendor[] }) {
  const [editTarget, setEditTarget] = useState<Vendor | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function openAdd() {
    setEditTarget(null);
    setDialogOpen(true);
  }

  function handleDelete(id: number) {
    if (!confirm("Bu firmayı silmek istediğinize emin misiniz?")) return;
    startTransition(() => { void deleteVendor(id); });
  }

  return (
    <>
      <div className="flex items-center justify-between pb-4">
        <p className="text-sm text-muted-foreground">{vendors.length} firma</p>
        <Button size="sm" onClick={openAdd}>Firma Ekle</Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Adı</TableHead>
              <TableHead>Tür</TableHead>
              <TableHead>İletişim</TableHead>
              <TableHead>IBAN</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendors.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Henüz firma yok.
                </TableCell>
              </TableRow>
            )}
            {vendors.map((vendor) => (
              <TableRow key={vendor.id}>
                <TableCell className="font-medium">{vendor.name}</TableCell>
                <TableCell>
                  <Badge variant={TYPE_VARIANTS[vendor.vendorType] ?? "outline"}>
                    {vendor.vendorType}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground max-w-48 truncate">
                  {vendor.contactInfo ?? "—"}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {vendor.iban ?? "—"}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger className={buttonVariants({ variant: "ghost", size: "icon" })}>
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setEditTarget(vendor); setDialogOpen(true); }}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Düzenle
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        disabled={isPending}
                        onClick={() => handleDelete(vendor.id)}
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

      <VendorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        vendor={editTarget ?? undefined}
      />
    </>
  );
}
