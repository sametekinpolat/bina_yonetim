"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { useRouter } from "next/navigation";

export function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{
    total: number;
    autoMatched: number;
    skipped?: string[];
  } | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) return;
    setError("");
    setResult(null);

    const fd = new FormData();
    fd.append("file", file);

    startTransition(async () => {
      const res = await fetch("/api/bank-import", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Yükleme başarısız.");
      } else {
        setResult({
          total: json.total,
          autoMatched: json.autoMatched,
          skipped: json.skipped,
        });
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border p-4">
      <div>
        <p className="text-sm font-medium">Banka Ekstresi Yükle (.xlsx)</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Beklenen sütun sırası:
          <span className="ml-1 font-mono">
            Tarih | Saat | Tutar | Bakiye | Borç/Alacak | Açıklama | Fiş/Dekont No
          </span>
        </p>
      </div>

      {/* Expected format hint */}
      <div className="rounded-md bg-muted/40 border px-3 py-2 text-xs text-muted-foreground flex gap-2 items-start">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          <strong>Borç/Alacak</strong> sütunundaki{" "}
          <span className="text-destructive font-medium">B</span> (Borç) satırları <em>gider</em>,{" "}
          <span className="text-emerald-600 font-medium">A</span> (Alacak) satırları <em>gelir</em> olarak içe aktarılır.
          Tutarlar otomatik olarak Türkçe format (28.075,00) ile ayrıştırılır.
        </span>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-1.5 flex-1">
          <Label htmlFor="file" className="text-xs">Excel dosyası</Label>
          <Input
            id="file"
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <Button type="submit" disabled={!file || isPending}>
          <Upload className="mr-2 h-4 w-4" />
          {isPending ? "Yükleniyor…" : "Yükle"}
        </Button>
      </div>

      {result && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
            {result.total} satır içe aktarıldı — {result.autoMatched} otomatik eşleşti.
          </div>
          {result.skipped && result.skipped.length > 0 && (
            <div className="text-xs text-amber-600 dark:text-amber-400">
              {result.skipped.length} satır atlandı: {result.skipped.slice(0, 3).join("; ")}
              {result.skipped.length > 3 && ` … ve ${result.skipped.length - 3} daha`}
            </div>
          )}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />{error}
        </div>
      )}
    </form>
  );
}
