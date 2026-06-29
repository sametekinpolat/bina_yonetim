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
  rawDate: string;
  rawAmount: string;
  rawDescription: string | null;
  parsedFlatNumber: number | null;
  status: string;
  direction: "Gelir" | "Gider" | null;
  linkedInvoiceId: number | null;
  linkedVendorId: number | null;
  invoiceLabel: string | null;
  vendorLabel: string | null;
  reconciledBy: string | null;
  baseAmount: string | null;
  surchargeAmount: string | null;
  surchargeType: string | null;
};

type AccountOption = { id: number; accountName: string };
type InvoiceOption = { id: number; label: string };
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
  const [isPending, startTransition] = useTransition();

  // Income match dialog state
  const [incomeMatchTarget, setIncomeMatchTarget] = useState<StagingRow | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");

  // Expense match dialog state
  const [expenseMatchTarget, setExpenseMatchTarget] = useState<StagingRow | null>(null);
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [baseAmount, setBaseAmount] = useState("");
  const [surchargeAmount, setSurchargeAmount] = useState("");
  const [surchargeType, setSurchargeType] = useState<string>("");

  // Direct match dialog state
  const [directMatchTarget, setDirectMatchTarget] = useState<StagingRow | null>(null);
  const [directDirection, setDirectDirection] = useState<"Gelir" | "Gider">("Gelir");
  const [directDescription, setDirectDescription] = useState("");

  const batches = [...new Set(rows.map((r) => r.batchId))];
  const needsAction = rows.filter((r) => r.status === "Bekliyor").length;
  const matched = rows.filter(
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
  }

  function saveIncomeMatch() {
    if (!incomeMatchTarget || !selectedInvoiceId) return;
    startTransition(async () => {
      await manualMatch(incomeMatchTarget.id, parseInt(selectedInvoiceId));
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
  }

  function saveDirectMatch() {
    if (!directMatchTarget || !directDescription) return;
    startTransition(async () => {
      await directMatch(directMatchTarget.id, directDirection, directDescription);
      setDirectMatchTarget(null);
    });
  }

  function unmatch(row: StagingRow) {
    startTransition(async () => { await unmatchStagingRow(row.id); });
  }

  function deleteBatch(batchId: string) {
    if (!confirm("Bu batch'teki tüm satırlar silinsin mi?")) return;
    startTransition(async () => { await deleteStagingBatch(batchId); });
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function renderLinkedLabel(row: StagingRow) {
    const dir = row.direction ?? "Gelir";
    if (dir === "Gider") {
      if (row.vendorLabel) return row.vendorLabel;
      return <span className="text-muted-foreground">—</span>;
    }
    if (row.invoiceLabel) return row.invoiceLabel;
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
              if (confirm("Ekstre satırı geri alınacak. Lütfen bağlı işlemi 'İşlemler' menüsünden silmeyi unutmayın!")) {
                startTransition(async () => { await revertStagingRow(row.id); });
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
        {isPendingRow && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => openDirectMatch(row)}
          >
            Direkt İşle
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
          <span>{rows.length} satır</span>
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

      {/* Batch delete buttons */}
      {batches.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {batches.map((b) => (
            <Button key={b} size="sm" variant="outline" onClick={() => deleteBatch(b)}>
              <Trash2 className="mr-1.5 h-3 w-3" />
              Yüklemeyi sil {b.slice(0, 8)}…
            </Button>
          ))}
        </div>
      )}

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
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  Satır yok. Yukarıdan banka ekstresi yükleyin.
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => {
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
                  onValueChange={(v) => { if (v) setSelectedInvoiceId(v); }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Fatura seçin…">
                      {(val: string) => debts.find(d => d.id.toString() === val)?.label || val}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="w-[400px]">
                    {invoices.map((inv) => (
                      <SelectItem key={inv.id} value={inv.id.toString()}>{inv.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIncomeMatchTarget(null)}>İptal</Button>
            <Button disabled={!selectedInvoiceId || isPending} onClick={saveIncomeMatch}>
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
                <Select value={directDirection} onValueChange={(v) => { if (v === "Gelir" || v === "Gider") setDirectDirection(v); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Yön seçin…">
                      {(val: string) => val}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Gelir">Gelir</SelectItem>
                    <SelectItem value="Gider">Gider</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
            <Button disabled={!directDescription || isPending} onClick={saveDirectMatch}>
              {isPending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
