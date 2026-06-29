import { db } from "@/lib/db";
import { vendors, vendorPayables, transactions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { VendorsTable } from "@/components/admin/vendors/vendors-table";
import { VendorLedgerPanel, LedgerItem } from "@/components/admin/vendors/vendor-ledger-panel";
import { Badge } from "@/components/ui/badge";
import Decimal from "decimal.js";

function fmt(val: string) {
  return `₺${Number(val).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`;
}

export default async function VendorsPage() {
  const allVendors = await db.select().from(vendors).orderBy(vendors.name);

  // Fetch all payables (debts)
  const allPayables = await db
    .select()
    .from(vendorPayables)
    .orderBy(vendorPayables.createdAt);

  // Fetch all transactions (payments) for vendors
  const allPayments = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.transactionType, "Gider")))
    .orderBy(transactions.transactionDate);

  // Group ledger items by vendorId
  const ledgerByVendor = new Map<number, LedgerItem[]>();

  for (const p of allPayables) {
    const list = ledgerByVendor.get(p.vendorId) ?? [];
    list.push({
      id: `payable-${p.id}`,
      type: "debt",
      date: p.createdAt?.toISOString() ?? new Date().toISOString(),
      description: p.description,
      amount: p.invoiceAmount,
      originalId: p.id,
    });
    ledgerByVendor.set(p.vendorId, list);
  }

  for (const tx of allPayments) {
    if (tx.vendorId) {
      const list = ledgerByVendor.get(tx.vendorId) ?? [];
      list.push({
        id: `payment-${tx.id}`,
        type: "payment",
        date: tx.transactionDate,
        description: tx.description ?? "Ödeme",
        amount: tx.amount,
        originalId: tx.id,
      });
      ledgerByVendor.set(tx.vendorId, list);
    }
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

      {/* Per-vendor ledger sections */}
      {allVendors.map((vendor) => {
        const ledger = ledgerByVendor.get(vendor.id) ?? [];
        if (ledger.length === 0) return null;

        // Calculate balance for this vendor
        const balance = ledger.reduce((acc, item) => {
          if (item.type === "debt") return acc.add(new Decimal(item.amount));
          if (item.type === "payment") return acc.sub(new Decimal(item.amount));
          return acc;
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
            <VendorLedgerPanel
              vendor={{ id: vendor.id, name: vendor.name }}
              ledger={ledger}
            />
          </div>
        );
      })}
    </div>
  );
}
