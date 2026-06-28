import { db } from "@/lib/db";
import { vendors, vendorPayables } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { VendorsTable } from "@/components/admin/vendors/vendors-table";
import { VendorPayablesPanel } from "@/components/admin/vendors/vendor-payables-panel";
import { Badge } from "@/components/ui/badge";
import Decimal from "decimal.js";

function fmt(val: string) {
  return `₺${Number(val).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`;
}

export default async function VendorsPage() {
  const allVendors = await db.select().from(vendors).orderBy(vendors.name);

  // Fetch all payables grouped by vendor
  const allPayables = await db
    .select()
    .from(vendorPayables)
    .orderBy(vendorPayables.vendorId, vendorPayables.createdAt);

  // Group payables by vendorId
  const payablesByVendor = new Map<number, typeof allPayables>();
  for (const p of allPayables) {
    const list = payablesByVendor.get(p.vendorId) ?? [];
    list.push(p);
    payablesByVendor.set(p.vendorId, list);
  }

  return (
    <div className="p-6 space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Firmalar</h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">
          Ödeme yaptığınız şirketler, personel ve kamu kurumları.
        </p>
        <VendorsTable vendors={allVendors as any} />
      </div>

      {/* Per-vendor payables sections */}
      {allVendors.map((vendor) => {
        const payables = payablesByVendor.get(vendor.id) ?? [];
        if (payables.length === 0) return null;

        // Calculate balance for this vendor
        const balance = payables.reduce((acc, p) => {
          return acc.add(new Decimal(p.invoiceAmount).minus(new Decimal(p.amountPaid ?? "0")));
        }, new Decimal(0));
        const balanceNum = balance.toNumber();

        return (
          <div key={vendor.id} className="border rounded-lg p-5 space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-medium">{vendor.name}</h2>
              <Badge
                variant={
                  balanceNum > 0 ? "destructive" : balanceNum < 0 ? "default" : "secondary"
                }
              >
                {balanceNum > 0
                  ? `Borçluyuz: ${fmt(balance.toFixed(2))}`
                  : balanceNum < 0
                  ? `Alacaklıyız: ${fmt(balance.abs().toFixed(2))}`
                  : "Bakiye Yok"}
              </Badge>
            </div>
            <VendorPayablesPanel
              vendor={{ id: vendor.id, name: vendor.name }}
              payables={payables.map((p) => ({
                id: p.id,
                description: p.description,
                invoiceAmount: p.invoiceAmount,
                amountPaid: p.amountPaid ?? "0",
                dueDate: p.dueDate,
                paymentStatus: p.paymentStatus ?? "Ödenmedi",
                notes: p.notes,
                periodId: p.periodId,
                planExpenseId: p.planExpenseId,
                createdAt: p.createdAt?.toISOString() ?? null,
              }))}
            />
          </div>
        );
      })}
    </div>
  );
}
