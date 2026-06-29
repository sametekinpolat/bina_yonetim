import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import {
  billingPeriods, monthlyInvoices, flats, flatRelationships, people,
} from "@/lib/db/schema";
import { eq, isNull, sql } from "drizzle-orm";

const MONTHS = [
  "", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

const STATUS_LABELS: Record<string, string> = {
  "Ödenmedi": "Ödenmedi",
  "Kısmi": "Kısmi",
  "Ödendi": "Ödendi",
  "Fazla Ödendi": "Fazla Ödendi",
  "Taslak": "Taslak",
  "Yayınlandı": "Yayınlandı",
  "Kapandı": "Kapandı",
};

function fmt(val: string | null | undefined) {
  if (!val) return "—";
  return Number(val).toLocaleString("tr-TR", { minimumFractionDigits: 2 });
}

function total(invoices: { totalDue: string; amountPaid: string | null }[]) {
  let due = 0, paid = 0;
  for (const inv of invoices) {
    due += Number(inv.totalDue);
    paid += Number(inv.amountPaid ?? 0);
  }
  return { due, paid, outstanding: due - paid };
}

export default async function PrintPeriodPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const periodId = parseInt(id);
  if (isNaN(periodId)) notFound();

  const [period] = await db
    .select()
    .from(billingPeriods)
    .where(eq(billingPeriods.id, periodId))
    .limit(1);
  if (!period) notFound();

  const invoiceRows = await db
    .select({
      id: monthlyInvoices.id,
      flatId: monthlyInvoices.flatId,
      flatNumber: flats.flatNumber,
      gasFee: monthlyInvoices.gasFee,
      waterFee: monthlyInvoices.waterFee,
      otherFee: monthlyInvoices.otherFee,
      totalDue: monthlyInvoices.totalDue,
      amountPaid: monthlyInvoices.amountPaid,
      status: monthlyInvoices.status,
    })
    .from(monthlyInvoices)
    .innerJoin(flats, eq(flats.id, monthlyInvoices.flatId))
    .where(eq(monthlyInvoices.periodId, periodId))
    .orderBy(flats.flatNumber);

  const relationships = await db
    .select({
      flatId: flatRelationships.flatId,
      fullName: sql<string>`${people.firstName} || ' ' || ${people.lastName}`.as("full_name"),
    })
    .from(flatRelationships)
    .innerJoin(people, eq(people.id, flatRelationships.personId))
    .where(isNull(flatRelationships.moveOutDate));

  const residentMap = new Map<number, string>();
  for (const rel of relationships) {
    if (!residentMap.has(rel.flatId)) residentMap.set(rel.flatId, rel.fullName);
  }

  const totals = total(invoiceRows.map((r) => ({
    totalDue: r.totalDue,
    amountPaid: r.amountPaid,
  })));

  const statusColor: Record<string, string> = {
    "Ödendi": "#16a34a",
    "Ödenmedi": "#dc2626",
    "Kısmi": "#d97706",
    "Fazla Ödendi": "#2563eb",
  };

  return (
    <div style={{ padding: "32px", maxWidth: "900px", margin: "0 auto" }}>
      {/* Print button — hidden when printing */}
      <div className="no-print" style={{ marginBottom: "24px", textAlign: "right" }}>
        <PrintButton />
      </div>

      {/* Header */}
      <div style={{ borderBottom: "2px solid #e2e8f0", paddingBottom: "16px", marginBottom: "24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: "700", margin: 0 }}>
          {period.periodName} — Fatura Özeti
        </h1>
        <p style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>
          {MONTHS[period.periodMonth]} {period.periodYear} · Durum: {STATUS_LABELS[period.status ?? ""] ?? period.status}
          {period.publishedAt && ` · Yayınlanma Tarihi: ${new Date(period.publishedAt).toLocaleDateString("tr-TR")}`}
        </p>
      </div>

      {/* Distribution summary */}
      {period.distributedGas && (
        <div style={{ display: "flex", gap: "16px", marginBottom: "24px", flexWrap: "wrap" }}>
          {[
            ["Dağıtılan Gaz", period.distributedGas],
            ["Dağıtılan Su", period.distributedWater],
            ["Dağıtılan Aidat", period.distributedDues],
            ["Yuvarlama Farkı", period.totalRoundingDiff],
          ].map(([label, value]) => (
            <div key={label as string} style={{
              border: "1px solid #e2e8f0", borderRadius: "6px",
              padding: "10px 14px", minWidth: "160px",
            }}>
              <p style={{ fontSize: "11px", color: "#64748b", margin: 0 }}>{label}</p>
              <p style={{ fontSize: "14px", fontWeight: "600", margin: "2px 0 0" }}>
                ₺{fmt(value as string)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Invoice table */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
        <thead>
          <tr style={{ background: "#f1f5f9" }}>
            {["Daire No", "Sakin", "Gaz (₺)", "Su (₺)", "Aidat (₺)", "Toplam Borç (₺)", "Ödenen (₺)", "Kalan (₺)", "Durum"].map((h) => (
              <th key={h} style={{
                padding: "8px 10px", textAlign: h === "Daire No" || h === "Durum" ? "center" : "right",
                fontWeight: "600", borderBottom: "2px solid #cbd5e1", whiteSpace: "nowrap",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {invoiceRows.map((inv, i) => {
            const outstanding = Number(inv.totalDue) - Number(inv.amountPaid ?? 0);
            return (
              <tr key={inv.id} style={{ background: i % 2 === 0 ? "white" : "#f8fafc" }}>
                <td style={{ padding: "7px 10px", textAlign: "center", fontWeight: "500" }}>
                  {inv.flatNumber}
                </td>
                <td style={{ padding: "7px 10px" }}>
                  {residentMap.get(inv.flatId) ?? "—"}
                </td>
                {[inv.gasFee, inv.waterFee, inv.otherFee, inv.totalDue, inv.amountPaid].map((v, j) => (
                  <td key={j} style={{ padding: "7px 10px", textAlign: "right", fontFamily: "monospace" }}>
                    {fmt(v)}
                  </td>
                ))}
                <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "monospace" }}>
                  {outstanding.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                </td>
                <td style={{
                  padding: "7px 10px", textAlign: "center", fontWeight: "600",
                  color: statusColor[inv.status ?? "Ödenmedi"] ?? "#374151",
                }}>
                  {STATUS_LABELS[inv.status ?? ""] ?? inv.status}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ background: "#f1f5f9", fontWeight: "700", borderTop: "2px solid #cbd5e1" }}>
            <td style={{ padding: "8px 10px" }} colSpan={5}>TOPLAM</td>
            <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace" }}>
              {totals.due.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
            </td>
            <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace" }}>
              {totals.paid.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
            </td>
            <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace" }}>
              {totals.outstanding.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>

      <p style={{ fontSize: "11px", color: "#94a3b8", marginTop: "24px", textAlign: "right" }}>
        Oluşturulma tarihi {new Date().toLocaleString("tr-TR")} · Apartman Yönetim
      </p>
    </div>
  );
}
