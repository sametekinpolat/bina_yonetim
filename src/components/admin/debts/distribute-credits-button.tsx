"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { distributeCredits } from "@/actions/credits";

export function DistributeCreditsButton() {
  const [isPending, startTransition] = useTransition();

  const handleDistribute = () => {
    startTransition(async () => {
      const result = await distributeCredits();
      if (result.error) {
        alert(result.error);
      } else {
        alert("Krediler ileri taşındı ve dağıtıldı.");
      }
    });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDistribute}
      disabled={isPending}
      title="Tüm daireler için fazla ödemeleri (kredileri) ödenmemiş sonraki aylara aktarır."
    >
      {isPending ? (
        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
      ) : (
        <ArrowRightLeft className="mr-1.5 h-4 w-4" />
      )}
      Kredileri Dağıt
    </Button>
  );
}
