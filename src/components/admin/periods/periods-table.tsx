"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { MoreHorizontal, Trash2, ExternalLink } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { PeriodDialog } from "./period-dialog";
import { deletePeriod } from "@/actions/billing";

type Period = {
  id: number;
  periodName: string;
  periodYear: number;
  periodMonth: number;
  status: "Taslak" | "Yayınlandı" | "Kapandı";
  distributedGas: string | null;
  distributedWater: string | null;
  distributedDues: string | null;
  totalRoundingDiff: string | null;
  publishedAt: Date | null;
};

const statusVariants: Record<string, "default" | "secondary" | "outline"> = {
  "Taslak": "outline",
  "Yayınlandı": "default",
  "Kapandı": "secondary",
};

function fmt(val: string | null) {
  if (!val) return "—";
  return `₺${Number(val).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`;
}

export function PeriodsTable({ periods }: { periods: Period[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete(id: number) {
    if (!confirm("Bu dönemi ve tüm faturalarını silmek istediğinize emin misiniz?")) return;
    startTransition(() => { void deletePeriod(id); });
  }

  return (
    <>
      <div className="flex items-center justify-between pb-4">
        <p className="text-sm text-muted-foreground">{periods.length} dönem</p>
        <Button size="sm" onClick={() => setDialogOpen(true)}>Yeni Dönem</Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dönem</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead className="text-right">Doğalgaz</TableHead>
              <TableHead className="text-right">Su</TableHead>
              <TableHead className="text-right">Aidat</TableHead>
              <TableHead className="text-right">Yuvarlama Farkı</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {periods.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Henüz aidat dönemi yok.
                </TableCell>
              </TableRow>
            )}
            {periods.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Link
                    href={`/periods/${p.id}`}
                    className="font-medium hover:underline"
                  >
                    {p.periodName}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariants[p.status] ?? "outline"}>
                    {p.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{fmt(p.distributedGas)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(p.distributedWater)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(p.distributedDues)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {p.totalRoundingDiff
                    ? `${Number(p.totalRoundingDiff) >= 0 ? "+" : ""}${Number(p.totalRoundingDiff).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺`
                    : "—"}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger className={buttonVariants({ variant: "ghost", size: "icon" })}>
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem render={<Link href={`/periods/${p.id}`} />}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Aç
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={isPending || p.status !== "Taslak"}
                        onClick={() => handleDelete(p.id)}
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

      <PeriodDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
