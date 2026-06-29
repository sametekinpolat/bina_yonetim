"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { calculatePeriod, publishPeriod, closePeriod } from "@/actions/billing";
import { Calculator, Globe, Lock } from "lucide-react";

interface PeriodActionsProps {
  periodId: number;
  status: "Taslak" | "Yayınlandı" | "Kapandı";
}

export function PeriodActions({ periodId, status }: PeriodActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleCalculate() {
    startTransition(async () => {
      const result = await calculatePeriod(periodId);
      if (result.error) alert(result.error);
    });
  }

  function handlePublish() {
    if (!confirm("Bu dönemi yayınlamak istediğinize emin misiniz? Sakinler faturalarını görebilecek.")) return;
    startTransition(async () => {
      const result = await publishPeriod(periodId);
      if (result.error) alert(result.error);
      else router.refresh();
    });
  }

  function handleClose() {
    if (!confirm("Bu dönemi kapatmak istediğinize emin misiniz? Bu işlem kalan tüm faturaları kesinleştirir.")) return;
    startTransition(async () => {
      await closePeriod(periodId);
      router.refresh();
    });
  }

  return (
    <div className="flex gap-2">
      {status !== "Kapandı" && (
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={handleCalculate}
        >
          <Calculator className="mr-1.5 h-4 w-4" />
          {isPending ? "Hesaplanıyor…" : "Hesapla"}
        </Button>
      )}
      {status === "Taslak" && (
        <Button size="sm" disabled={isPending} onClick={handlePublish}>
          <Globe className="mr-1.5 h-4 w-4" />
          Yayınla
        </Button>
      )}
      {status === "Yayınlandı" && (
        <Button variant="secondary" size="sm" disabled={isPending} onClick={handleClose}>
          <Lock className="mr-1.5 h-4 w-4" />
          Dönemi Kapat
        </Button>
      )}
    </div>
  );
}
