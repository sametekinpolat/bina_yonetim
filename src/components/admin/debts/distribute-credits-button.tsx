"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { refreshInvoiceBalances } from "@/actions/credits";

export function DistributeCreditsButton() {
  const [isPending, startTransition] = useTransition();

  const handleDistribute = () => {
    startTransition(async () => {
      const result = await refreshInvoiceBalances();
      if (result.error) {
        alert(result.error);
      } else {
        alert(`${result.invoiceCount} fatura bakiyesi, daire ve dönem türüne göre ödeme kayıtlarından yenilendi.`);
      }
    });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDistribute}
      disabled={isPending}
      title="Aylık ödemeleri dairenin yayınlanmış aylarına sırayla aktarır. Ek dönem ödemeleri ayrı kalır; işlem kayıtları korunur."
    >
      {isPending ? (
        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
      ) : (
        <ArrowRightLeft className="mr-1.5 h-4 w-4" />
      )}
      Ödemeleri Yenile
    </Button>
  );
}
