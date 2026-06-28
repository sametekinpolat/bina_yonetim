import { db } from "@/lib/db";
import { billingPeriods } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { PeriodsTable } from "@/components/admin/periods/periods-table";

export default async function PeriodsPage() {
  const periods = await db
    .select()
    .from(billingPeriods)
    .orderBy(desc(billingPeriods.periodYear), desc(billingPeriods.periodMonth));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Aidat Dönemleri</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Aylık aidat dönemlerini oluşturun ve yönetin.
      </p>
      <PeriodsTable periods={periods as any} />
    </div>
  );
}
