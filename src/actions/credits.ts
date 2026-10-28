"use server";

import { auth } from "@/lib/auth";
import { recalculateAllInvoicePayments } from "@/lib/db/invoice-payments";
import { revalidatePath } from "next/cache";

export async function refreshInvoiceBalances() {
  const session = await auth();
  if (!session) return { error: "Unauthorized" };

  try {
    const invoiceCount = await recalculateAllInvoicePayments();
    revalidatePath("/debts");
    revalidatePath("/periods");
    revalidatePath("/dashboard");
    revalidatePath("/bank-import");
    return { success: true, invoiceCount };
  } catch (error) {
    console.error("Failed to refresh invoice balances:", error);
    return { error: "Fatura bakiyeleri ödeme kayıtlarından yeniden dağıtılamadı." };
  }
}
