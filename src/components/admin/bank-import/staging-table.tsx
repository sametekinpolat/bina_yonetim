"use client";

import { useState, useTransition } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, XCircle, Link2, Trash2, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import {
  approveStagingRow,
  manualMatch,
  manualSplitMatch,
  ignoreStagingRow,
  deleteStagingBatch,
  linkVendorToStagingRow,
  directMatch,
  unmatchStagingRow,
  revertStagingRow,
} from "@/actions/bank-import";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StagingRow = {
  id: number;
  batchId: string;
  fileName: string | null;
  rawDate: string;
  rawAmount: string;
  rawDescription: string | null;
  parsedFlatNumber: number | null;
  status: string;
  direction: "Gelir" | "Gider" | null;
  linkedInvoiceId: number | null;
  linkedSplitInvoiceId: number | null;
  linkedInvoiceAmount: string | null;
  linkedVendorId: number | null;
  linkedTransferAccountId: number | null;
  invoiceLabel: string | null;
  splitInvoiceLabel: string | null;
  vendorLabel: string | null;
  transferAccountLabel: string | null;
  reconciledBy: string | null;
  baseAmount: string | null;
  surchargeAmount: string | null;
  surchargeType: string | null;
};

type AccountOption = { id: number; accountName: string };
type InvoiceOption = { id: number; flatId: number; periodType: string; label: string };
type VendorOption = { id: number; label: string };

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  "Bekliyor": "outline",
  "Otomatik Eşleşti": "default",
  "Manuel Eşleşti": "secondary",
  "Yok Sayıldı": "destructive",
};

const SURCHARGE_TYPES = ["Faiz", "Ceza", "Ücret", "Yuvarlama"] as const;

const SURCHARGE_LABELS: Record<string, string> = {
  "Faiz": "Faiz",
  "Ceza": "Ceza",
  "Ücret": "Ücret",
  "Yuvarlama": "Yuvarlama",
};

const STATUS_LABELS: Record<string, string> = {
  "Bekliyor": "Bekliyor",
  "Otomatik Eşleşti": "Otomatik",
  "Manuel Eşleşti": "Manuel",
  "Yok Sayıldı": "Yok Sayıldı",
};

function fmt(val: string) {
  return `₺${Number(val).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function StagingTable({
  rows, accounts, invoices, vendors,
}: {
  rows: StagingRow[];
  accounts: AccountOption[];
  invoices: InvoiceOption[];
  vendors: VendorOption[];
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id.toString() ?? "");
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [isPending, startTransition] = useTransition();

  // Income match dialog state
  const [incomeMatchTarget, setIncomeMatchTarget] = useState<StagingRow | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [splitIncome, setSplitIncome] = useState(false);
  const [splitInvoiceId, setSplitInvoiceId] = useState("");
  const [firstInvoiceAmount, setFirstInvoiceAmount] = useState("");

  // Expense match dialog state
  const [expenseMatchTarget, setExpenseMatchTarget] = useState<StagingRow | null>(null);
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [baseAmount, setBaseAmount] = useState("");
  const [surchargeAmount, setSurchargeAmount] = useState("");
  const [surchargeType, setSurchargeType] = useState<string>("");

  // Direct match dialog state
  const [directMatchTarget, setDirectMatchTarget] = useState<StagingRow | null>(null);
  const [directDirection, setDirectDirection] = useState<"Gelir" | "Gider" | "Transfer">("Gelir");
  const [directDescription, setDirectDescription] = useState("");
  const [transferAccountId, setTransferAccountId] = useState("");

  const batchMap = new Map<string, { fileName: string | null; latestRowId: number; count: number }>();
  for (const row of rows) {
    const batch = batchMap.get(row.batchId);
    if (batch) {
      batch.count++;
      batch.latestRowId = Math.max(batch.latestRowId, row.id);
      batch.fileName ??= row.fileName;
    } else {
      batchMap.set(row.batchId, { fileName: row.fileName, latestRowId: row.id, count: 1 });
    }
  }
  const batches = [...batchMap.entries()].sort((a, b) => b[1].latestRowId - a[1].latestRowId);
  const activeBatchId = batches.some(([batchId]) => batchId === selectedBatchId)
    ? selectedBatchId
    : batches[0]?.[0] ?? "";
  const visibleRows = rows.filter((row) => row.batchId === activeBatchId);
  const needsAction = visibleRows.filter((r) => r.status === "Bekliyor").length;
  const matched = visibleRows.filter(
    (r) => r.status === "Otomatik Eşleşti" || r.status === "Manuel Eşleşti",
  ).length;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function approve(row: StagingRow) {
    if (!accountId) return;
    startTransition(async () => {
      await approveStagingRow(row.id, parseInt(accountId));
    });
  }

  function ignore(row: StagingRow) {
    startTransition(async () => { await ignoreStagingRow(row.id); });
  }

  function openIncomeMatch(row: StagingRow) {
    setIncomeMatchTarget(row);
    setSelectedInvoiceId(row.linkedInvoiceId?.toString() ?? "");
    setSplitIncome(!!row.linkedSplitInvoiceId);
    setSplitInvoiceId(row.linkedSplitInvoiceId?.toString() ?? "");
    setFirstInvoiceAmount(row.linkedInvoiceAmount ?? row.rawAmount);
  }

  function saveIncomeMatch() {
    if (!incomeMatchTarget || !selectedInvoiceId) return;
    startTransition(async () => {
      const result = splitIncome
        ? await manualSplitMatch(
            incomeMatchTarget.id,
            parseInt(selectedInvoiceId),
            parseInt(splitInvoiceId),
            parseFloat(firstInvoiceAmount),
          )
        : await manualMatch(incomeMatchTarget.id, parseInt(selectedInvoiceId));
      if (result && "error" in result && result.error) {
        alert(result.error);
        return;
      }
      setIncomeMatchTarget(null);
    });
  }

  function openExpenseMatch(row: StagingRow) {
    setExpenseMatchTarget(row);
    setSelectedVendorId(row.linkedVendorId?.toString() ?? "");
    setBaseAmount(row.baseAmount ?? row.rawAmount);
    setSurchargeAmount(row.surchargeAmount ?? "");
    setSurchargeType(row.surchargeType ?? "");
  }

  function saveExpenseMatch() {
    if (!expenseMatchTarget || !selectedVendorId || !baseAmount) return;
    startTransition(async () => {
      await linkVendorToStagingRow(
        expenseMatchTarget.id,
        parseInt(selectedVendorId),
        parseFloat(baseAmount),
        surchargeAmount ? parseFloat(surchargeAmount) : undefined,
        (surchargeType as "Faiz" | "Ceza" | "Ücret" | "Yuvarlama") || undefined,
      );
      setExpenseMatchTarget(null);
    });
  }

  function openDirectMatch(row: StagingRow) {
    setDirectMatchTarget(row);
    setDirectDirection(row.direction ?? "Gelir");
    setDirectDescription(row.rawDescription ?? "");
    setTransferAccountId(row.linkedTransferAccountId?.toString() ?? "");
  }

  function saveDirectMatch() {
    if (!directMatchTarget || !directDescription || (directDirection === "Transfer" && !transferAccountId)) return;
    startTransition(async () => {
      const result = await directMatch(
        directMatchTarget.id,
        directDirection,
        directDescription,
        directDirection === "Transfer" ? parseInt(transferAccountId, 10) : undefined,
      );
      if (result?.error) {
        alert(result.error);
        return;
      }
      setDirectMatchTarget(null);
    });
  }

  function unmatch(row: StagingRow) {
    startTransition(async () => { await unmatchStagingRow(row.id); });
  }

  function deleteBatch(batchId: string) {
    if (!confirm("Bu Excel yüklemesindeki tüm satırlar ve bu satırların oluşturduğu işlemler silinecek. Bağlı fatura ödemeleri geri alınacak. Devam edilsin mi?")) return;
    startTransition(async () => {
      const result = await deleteStagingBatch(batchId);
      if (result && "error" in result && result.error) alert(result.error);
    });
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function renderLinkedLabel(row: StagingRow) {
    if (row.linkedTransferAccountId) {
      return row.transferAccountLabel ?? <span className="text-muted-foreground">Transfer hesabı</span>;
    }
    const dir = row.direction ?? "Gelir";
    if (dir === "Gider") {
      if (row.vendorLabel) return row.vendorLabel;
      return <span className="text-muted-foreground">—</span>;
    }
    if (row.invoiceLabel) return (
      <span>
        {row.invoiceLabel}
        {row.splitInvoiceLabel && (
          <span className="mt-1 block text-xs text-muted-foreground">
            {fmt(row.linkedInvoiceAmount ?? "0")} + {row.splitInvoiceLabel} ({fmt((Number(row.rawAmount) - Number(row.linkedInvoiceAmount ?? 0)).toFixed(2))})
          </span>
        )}
      </span>
    );
    return <span className="text-muted-foreground">—</span>;
  }

  function renderActions(row: StagingRow) {
    const isReconciled = !!row.reconciledBy;
    if (isReconciled) {
      return (
        <div className="flex justify-end gap-1.5 flex-wrap">
          <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600 mt-1">
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> İşlendi
          </Badge>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => {
              if (confirm("Bu satırın oluşturduğu işlem(ler) silinecek ve bağlı fatura ödemesi geri alınacak. Devam edilsin mi?")) {
                startTransition(async () => {
                  const result = await revertStagingRow(row.id);
                  if (result && "error" in result && result.error) alert(result.error);
                });
              }
            }}
          >
            Geri Al
          </Button>
        </div>
      );
    }

    const dir = row.direction ?? "Gelir";
    const isMatched = row.status === "Otomatik Eşleşti" || row.status === "Manuel Eşleşti";
    const isPendingRow = row.status === "Bekliyor";
    const isIgnored = row.status === "Yok Sayıldı";

    return (
      <div className="flex justify-end gap-1.5 flex-wrap">
        {isMatched && (
          <Button
            size="sm"
            disabled={!accountId || isPending}
            onClick={() => approve(row)}
          >
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
            Onayla
          </Button>
        )}
        {isMatched && (
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => unmatch(row)}
          >
            Eşleşmeyi Kaldır
          </Button>
        )}
        {isPendingRow && dir !== "Gider" && (
          <Button size="sm" variant="outline" onClick={() => openIncomeMatch(row)}>
            <Link2 className="mr-1.5 h-3.5 w-3.5" />
            Fatura Eşle
          </Button>
        )}
        {(isPendingRow || (isMatched && dir === "Gider")) && (
          <Button
            size="sm"
            variant={dir === "Gider" ? "secondary" : "outline"}
            onClick={() => openExpenseMatch(row)}
          >
            <ArrowDownCircle className="mr-1.5 h-3.5 w-3.5" />
            {dir === "Gider" && row.linkedVendorId ? "Ödeme Güncelle" : "Firma Eşle"}
          </Button>
        )}
        {(isPendingRow || isMatched) && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => openDirectMatch(row)}
          >
            {isMatched ? "Eşleşmeyi Değiştir" : "Direkt İşle"}
          </Button>
        )}
        {!isIgnored && (
          <Button
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={() => ignore(row)}
          >
            <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* Summary bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-4 text-sm">
          <span>{visibleRows.length} satır</span>
          <span className="text-amber-600 dark:text-amber-400">{needsAction} bekliyor</span>
          <span className="text-emerald-600">{matched} eşlendi</span>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Hesap:</Label>
          <Select value={accountId} onValueChange={(v) => { if (v) setAccountId(v); }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Hesap seç…">
                {(val: string) => accounts.find(a => a.id.toString() === val)?.accountName || val}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id.toString()}>{a.accountName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/20 p-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Label htmlFor="import-batch" className="shrink-0 text-sm">Yükleme:</Label>
          <Select value={activeBatchId} onValueChange={(value) => { if (value) setSelectedBatchId(value); }}>
            <SelectTrigger id="import-batch" className="min-w-0 max-w-xl flex-1">
              <SelectValue placeholder="Yükleme seçin">
                {(value: string) => {
                  const batch = batchMap.get(value);
                  return `${batch?.fileName || value.slice(0, 8)} · ${batch?.count ?? 0} satır`;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {batches.map(([batchId, batch]) => (
                <SelectItem key={batchId} value={batchId}>
                  {batch.fileName || batchId.slice(0, 8)} · {batch.count} satır
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {activeBatchId && (
          <Button size="sm" variant="outline" onClick={() => deleteBatch(activeBatchId)}>
            <Trash2 className="mr-1.5 h-3 w-3" /> Yüklemeyi sil
          </Button>
        )}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tarih</TableHead>
              <TableHead>Yön</TableHead>
              <TableHead className="text-right">Tutar</TableHead>
              <TableHead>Açıklama</TableHead>
              <TableHead>Daire</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead>Eşleşme</TableHead>
              <TableHead className="text-right">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  Satır yok. Yukarıdan banka ekstresi yükleyin.
                </TableCell>
              </TableRow>
            )}
            {visibleRows.map((row) => {
              const dir = row.direction ?? "Gelir";
              return (
                <TableRow key={row.id} className={row.status === "Yok Sayıldı" ? "opacity-40" : ""}>
                  <TableCell className="tabular-nums">{row.rawDate}</TableCell>
                  <TableCell>
                    {dir === "Gider" ? (
                      <span className="inline-flex items-center gap-1 text-xs text-destructive font-medium">
                        <ArrowDownCircle className="h-3.5 w-3.5" /> Gider
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        <ArrowUpCircle className="h-3.5 w-3.5" /> Gelir
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{fmt(row.rawAmount)}</TableCell>
                  <TableCell className="max-w-[180px] truncate text-sm text-muted-foreground" title={row.rawDescription ?? ""}>
                    {row.rawDescription ?? "—"}
                  </TableCell>
                  <TableCell>{row.parsedFlatNumber ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                          <Badge variant={STATUS_VARIANTS[row.status] ?? "outline"}>
                            {STATUS_LABELS[row.status] ?? row.status}
                          </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {renderLinkedLabel(row)}
                    {dir === "Gider" && row.surchargeAmount && Number(row.surchargeAmount) > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        + {fmt(row.surchargeAmount)} {row.surchargeType ? `(${SURCHARGE_LABELS[row.surchargeType] ?? row.surchargeType})` : ""}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>{renderActions(row)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Income match dialog */}
      <Dialog open={!!incomeMatchTarget} onOpenChange={(open) => { if (!open) setIncomeMatchTarget(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Fatura Eşle (Gelir)</DialogTitle>
          </DialogHeader>
          {incomeMatchTarget && (
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                <p><span className="text-muted-foreground">Tarih:</span> {incomeMatchTarget.rawDate}</p>
                <p><span className="text-muted-foreground">Tutar:</span> {fmt(incomeMatchTarget.rawAmount)}</p>
                {incomeMatchTarget.rawDescription && (
                  <p><span className="text-muted-foreground">Açıklama:</span> {incomeMatchTarget.rawDescription}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Fatura seçin</Label>
                <Select
                  value={selectedInvoiceId}
                  onValueChange={(v) => {
                    if (!v) return;
                    setSelectedInvoiceId(v);
                    const nextFirst = invoices.find((invoice) => invoice.id.toString() === v);
                    const currentSecond = invoices.find((invoice) => invoice.id.toString() === splitInvoiceId);
                    if (currentSecond && (currentSecond.flatId !== nextFirst?.flatId || currentSecond.periodType === nextFirst?.periodType)) {
                      setSplitInvoiceId("");
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Fatura seçin…">
                      {(val: string) => invoices.find(d => d.id.toString() === val)?.label || val}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="w-[400px]">
                    {invoices.map((inv) => (
                      <SelectItem key={inv.id} value={inv.id.toString()}>{inv.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={splitIncome}
                  onChange={(event) => setSplitIncome(event.target.checked)}
                  className="mt-0.5"
                />
                <span>Bu ödemeyi aylık aidat ve bir ek dönem arasında böl</span>
              </label>
              {splitIncome && (() => {
                const firstInvoice = invoices.find((invoice) => invoice.id.toString() === selectedInvoiceId);
                const secondOptions = invoices.filter((invoice) =>
                  invoice.flatId === firstInvoice?.flatId && invoice.periodType !== firstInvoice?.periodType
                );
                const remainder = Number(incomeMatchTarget.rawAmount) - Number(firstInvoiceAmount || 0);
                return (
                  <div className="space-y-3 rounded-md border border-dashed p-3">
                    <div className="flex flex-col gap-1.5">
                      <Label>İkinci fatura — farklı dönem türü</Label>
                      <Select value={splitInvoiceId} onValueChange={(value) => { if (value) setSplitInvoiceId(value); }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Ek dönem veya aylık fatura seçin">
                            {(value: string) => invoices.find((invoice) => invoice.id.toString() === value)?.label || value}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="w-[400px]">
                          {secondOptions.map((invoice) => (
                            <SelectItem key={invoice.id} value={invoice.id.toString()}>{invoice.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="first-invoice-amount">İlk faturaya ayrılacak tutar (₺)</Label>
                      <Input
                        id="first-invoice-amount"
                        type="number"
                        min="0.01"
                        max={Number(incomeMatchTarget.rawAmount) - 0.01}
                        step="0.01"
                        value={firstInvoiceAmount}
                        onChange={(event) => setFirstInvoiceAmount(event.target.value)}
                      />
                    </div>
                    <p className={`text-xs ${remainder > 0 ? "text-muted-foreground" : "text-destructive"}`}>
                      İkinci faturaya ayrılacak: {fmt(Math.max(0, remainder).toFixed(2))} · Toplam: {fmt(incomeMatchTarget.rawAmount)}
                    </p>
                    {secondOptions.length === 0 && <p className="text-xs text-destructive">Bu daire için diğer dönem türünde ödenmemiş fatura yok.</p>}
                  </div>
                );
              })()}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIncomeMatchTarget(null)}>İptal</Button>
            <Button disabled={!selectedInvoiceId || (splitIncome && (!splitInvoiceId || Number(firstInvoiceAmount) <= 0 || Number(firstInvoiceAmount) >= Number(incomeMatchTarget?.rawAmount ?? 0))) || isPending} onClick={saveIncomeMatch}>
              {isPending ? "Kaydediliyor…" : "Eşle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expense match dialog */}
      <Dialog open={!!expenseMatchTarget} onOpenChange={(open) => { if (!open) setExpenseMatchTarget(null); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Firma Ödemesi Eşle (Gider)</DialogTitle>
          </DialogHeader>
          {expenseMatchTarget && (
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                <p><span className="text-muted-foreground">Tarih:</span> {expenseMatchTarget.rawDate}</p>
                <p><span className="text-muted-foreground">Toplam tutar:</span> {fmt(expenseMatchTarget.rawAmount)}</p>
                {expenseMatchTarget.rawDescription && (
                  <p><span className="text-muted-foreground">Açıklama:</span> {expenseMatchTarget.rawDescription}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Firma Seçin</Label>
                <Select
                  value={selectedVendorId}
                  onValueChange={(v) => { if (v) setSelectedVendorId(v); }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Firma seçin…">
                      {(val: string) => vendors.find(v => v.id.toString() === val)?.label || val}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="w-[450px]">
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id.toString()}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="base-amount">
                    Firma Ödeme Tutarı (₺)
                    <span className="ml-1 text-xs text-muted-foreground">bakiye düşer</span>
                  </Label>
                  <Input
                    id="base-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={baseAmount}
                    onChange={(e) => setBaseAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="surcharge-amount">
                    Ek Ücret (₺)
                    <span className="ml-1 text-xs text-muted-foreground">bakiye düşmez</span>
                  </Label>
                  <Input
                    id="surcharge-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={surchargeAmount}
                    onChange={(e) => setSurchargeAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {surchargeAmount && Number(surchargeAmount) > 0 && (
                <div className="flex flex-col gap-1.5">
                  <Label>Ek Ücret Türü</Label>
                  <Select value={surchargeType} onValueChange={(v) => setSurchargeType(v ?? "")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tür seçin…">
                        {(val: string) => SURCHARGE_LABELS[val as keyof typeof SURCHARGE_LABELS] || val}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {SURCHARGE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{SURCHARGE_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Summary */}
              {baseAmount && (
                <div className="rounded-md bg-muted/50 border p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                     <span className="text-muted-foreground">Firmaya sayılan:</span>
                    <span className="tabular-nums font-medium">
                      {fmt(parseFloat(baseAmount || "0").toFixed(2))}
                    </span>
                  </div>
                  {surchargeAmount && Number(surchargeAmount) > 0 && (
                    <div className="flex justify-between text-destructive">
                      <span>{SURCHARGE_LABELS[surchargeType] ?? "Ek Ücret"} (firmaya sayılmaz):</span>
                      <span className="tabular-nums">
                        {fmt(parseFloat(surchargeAmount).toFixed(2))}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                    <span>Toplam:</span>
                    <span className={`tabular-nums ${
                      Math.abs(
                        parseFloat(baseAmount || "0") +
                        parseFloat(surchargeAmount || "0") -
                        parseFloat(expenseMatchTarget.rawAmount)
                      ) > 0.01
                        ? "text-destructive"
                        : "text-emerald-600"
                    }`}>
                      {fmt((parseFloat(baseAmount || "0") + parseFloat(surchargeAmount || "0")).toFixed(2))}
                      {Math.abs(
                        parseFloat(baseAmount || "0") +
                        parseFloat(surchargeAmount || "0") -
                        parseFloat(expenseMatchTarget.rawAmount)
                      ) > 0.01 && (
                        <span className="ml-2 text-xs">≠ {fmt(expenseMatchTarget.rawAmount)}</span>
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpenseMatchTarget(null)}>İptal</Button>
            <Button
              disabled={!selectedVendorId || !baseAmount || isPending}
              onClick={saveExpenseMatch}
            >
              {isPending ? "Kaydediliyor…" : "Eşle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Direct match dialog */}
      <Dialog open={!!directMatchTarget} onOpenChange={(open) => { if (!open) setDirectMatchTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Direkt İşle</DialogTitle>
          </DialogHeader>
          {directMatchTarget && (
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                <p><span className="text-muted-foreground">Tarih:</span> {directMatchTarget.rawDate}</p>
                <p><span className="text-muted-foreground">Tutar:</span> {fmt(directMatchTarget.rawAmount)}</p>
                {directMatchTarget.rawDescription && (
                  <p><span className="text-muted-foreground">Banka Açıklaması:</span> {directMatchTarget.rawDescription}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>İşlem Yönü</Label>
                <Select value={directDirection} onValueChange={(v) => { if (v === "Gelir" || v === "Gider" || v === "Transfer") setDirectDirection(v); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Yön seçin…">
                      {(val: string) => val}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Gelir">Gelir</SelectItem>
                    <SelectItem value="Gider">Gider</SelectItem>
                    <SelectItem value="Transfer">Hesaplar Arası Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {directDirection === "Transfer" && (
                <div className="flex flex-col gap-1.5">
                  <Label>Karşı Hesap</Label>
                  <Select value={transferAccountId} onValueChange={(v) => setTransferAccountId(v ?? "")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Karşı hesabı seçin…">
                        {(value: string) => accounts.find((a) => a.id.toString() === value)?.accountName || value}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.filter((a) => a.id.toString() !== accountId).map((a) => (
                        <SelectItem key={a.id} value={a.id.toString()}>{a.accountName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Karşı hesabı seçin. Transfer yönü ekstreden otomatik alınır.</p>
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <Label>Açıklama</Label>
                <Input
                  value={directDescription}
                  onChange={(e) => setDirectDescription(e.target.value)}
                  placeholder="İşlem açıklaması..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDirectMatchTarget(null)}>İptal</Button>
            <Button disabled={!directDescription || (directDirection === "Transfer" && !transferAccountId) || isPending} onClick={saveDirectMatch}>
              {isPending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
