import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
import { billingPeriods } from "@/lib/db/schema";
import { desc, inArray } from "drizzle-orm";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";

const MONTHS_TR = [
  "", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

function fmt(val: string | null | undefined) {
  if (!val) return "—";
  return `₺${Number(val).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`;
}

export default async function GuestListPage() {
  const periods = await db
    .select()
    .from(billingPeriods)
    .where(inArray(billingPeriods.status, ["Yayınlandı", "Kapandı"]))
    .orderBy(desc(billingPeriods.periodYear), desc(billingPeriods.periodMonth));

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Aylık Ödeme Kayıtları</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Yayınlanmış tüm dönemleri buradan görüntüleyebilirsiniz.
        </p>
      </div>

      {periods.length === 0 ? (
        <p className="text-sm text-muted-foreground">Henüz yayınlanmış dönem yok.</p>
      ) : (
        <Card>
          <div className="divide-y">
            {periods.map((p) => (
              <Link
                key={p.id}
                href={`/p/${p.id}`}
                className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <div>
                  <p className="text-sm font-medium">
                    {MONTHS_TR[p.periodMonth]} {p.periodYear}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Toplam: {fmt(p.rawDuesPlanned)}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </Card>
      )}
    </main>
  );
}
