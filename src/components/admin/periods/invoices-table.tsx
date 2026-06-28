import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type Invoice = {
  id: number;
  flatNumber: number;
  gasFee: string;
  waterFee: string;
  otherFee: string;
  totalDue: string;
  amountPaid: string;
  status: string;
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  "Ödenmedi": "destructive",
  "Kısmi": "secondary",
  "Ödendi": "default",
  "Fazla Ödendi": "outline",
};

function fmt(val: string) {
  return `₺${Number(val).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`;
}

export function InvoicesTable({ invoices }: { invoices: Invoice[] }) {
  if (invoices.length === 0) {
    return (
      <div className="rounded-lg border py-12 text-center text-sm text-muted-foreground">
        Henüz fatura yok — yukarıya fatura tutarlarını girip Hesapla'ya tıklayın.
      </div>
    );
  }

  const grandTotal = invoices.reduce((s, i) => s + Number(i.totalDue), 0);
  const totalPaid = invoices.reduce((s, i) => s + Number(i.amountPaid), 0);

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Daire</TableHead>
            <TableHead className="text-right">Doğalgaz</TableHead>
            <TableHead className="text-right">Su</TableHead>
            <TableHead className="text-right">Aidat</TableHead>
            <TableHead className="text-right font-semibold">Toplam Tutar</TableHead>
            <TableHead className="text-right">Ödenen</TableHead>
            <TableHead>Durum</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((inv) => (
            <TableRow key={inv.id}>
              <TableCell className="font-medium">#{inv.flatNumber}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {fmt(inv.gasFee)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {fmt(inv.waterFee)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {fmt(inv.otherFee)}
              </TableCell>
              <TableCell className="text-right tabular-nums font-medium">
                {fmt(inv.totalDue)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {fmt(inv.amountPaid)}
              </TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANTS[inv.status] ?? "outline"}>
                  {inv.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
          {/* Totals row */}
          <TableRow className="border-t-2 bg-muted/30">
            <TableCell className="font-semibold">Toplam</TableCell>
            <TableCell className="text-right tabular-nums font-medium">
              {fmt(String(invoices.reduce((s, i) => s + Number(i.gasFee), 0).toFixed(2)))}
            </TableCell>
            <TableCell className="text-right tabular-nums font-medium">
              {fmt(String(invoices.reduce((s, i) => s + Number(i.waterFee), 0).toFixed(2)))}
            </TableCell>
            <TableCell className="text-right tabular-nums font-medium">
              {fmt(String(invoices.reduce((s, i) => s + Number(i.otherFee), 0).toFixed(2)))}
            </TableCell>
            <TableCell className="text-right tabular-nums font-semibold">
              {fmt(grandTotal.toFixed(2))}
            </TableCell>
            <TableCell className="text-right tabular-nums font-medium">
              {fmt(totalPaid.toFixed(2))}
            </TableCell>
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
