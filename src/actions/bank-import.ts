"use server";

import { db } from "@/lib/db";
import {
  bankStatementImports, transactions, accounts, monthlyInvoices, billingPeriods,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import Decimal from "decimal.js";
import { z } from "zod";
import { recalculateInvoicePayment } from "@/lib/db/invoice-payments";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function rollbackImportRows(stagingIds: number[], removeStagingRows: boolean) {
  if (!stagingIds.length) return { success: true } as const;

  const result = await db.transaction(async (tx) => {
    const rows = await tx.select().from(bankStatementImports)
      .where(inArray(bankStatementImports.id, stagingIds));
    const ids = rows.map((row) => row.id);
    if (!ids.length) return { error: "Import rows not found." } as const;

    const createdTransactions = await tx.select({
      id: transactions.id,
      sourceImportId: transactions.sourceImportId,
      transactionType: transactions.transactionType,
      amount: transactions.amount,
      relatedInvoiceId: transactions.relatedInvoiceId,
    }).from(transactions).where(inArray(transactions.sourceImportId, ids));
    const transactionsByImport = new Map<number, typeof createdTransactions>();
    for (const transaction of createdTransactions) {
      if (transaction.sourceImportId === null) continue;
      const linked = transactionsByImport.get(transaction.sourceImportId) ?? [];
      linked.push(transaction);
      transactionsByImport.set(transaction.sourceImportId, linked);
    }

    // Pre-source links, do not guess based on matching amounts. This validation
    // happens before any updates so a batch remains intact if it cannot be reversed safely.
    for (const row of rows) {
      if (row.reconciledBy && !transactionsByImport.has(row.id)) {
        return {
          error: `Yüklemedeki eski bir işlem (${row.id}) kaynak bağlantısı olmadan oluşturulmuş. Güvenli geri alma için önce İşlemler sayfasından bu kaydı kontrol edin. Yükleme silinmedi.`,
        } as const;
      }
    }

    if (createdTransactions.length) {
      await tx.delete(transactions).where(inArray(transactions.id, createdTransactions.map((item) => item.id)));
    }
    if (removeStagingRows) {
      await tx.delete(bankStatementImports).where(inArray(bankStatementImports.id, ids));
    } else {
      await tx.update(bankStatementImports).set({
        reconciledBy: null,
        status: "Bekliyor",
        direction: null,
        linkedInvoiceId: null,
        linkedSplitInvoiceId: null,
        linkedInvoiceAmount: null,
        linkedPayableId: null,
        linkedVendorId: null,
        linkedTransferAccountId: null,
        baseAmount: null,
        surchargeAmount: null,
        surchargeType: null,
      }).where(inArray(bankStatementImports.id, ids));
    }
    return { success: true } as const;
  });

  if (result.success) {
    revalidatePath("/bank-import");
    revalidatePath("/transactions");
    revalidatePath("/accounts");
    revalidatePath("/debts");
    revalidatePath("/vendors");
  }
  return result;
}

// ---------------------------------------------------------------------------
// Income side: approve a resident payment row
// ---------------------------------------------------------------------------

export async function approveStagingRow(stagingId: number, accountId: number) {
  const session = await auth();
  if (!session) return { error: "Unauthorized" };

  const [row] = await db
    .select()
    .from(bankStatementImports)
    .where(eq(bankStatementImports.id, stagingId))
    .limit(1);

  if (!row) return { error: "Staging row not found." };
  if (row.status === "Yok Sayıldı") return { error: "Row is ignored." };
  if (row.reconciledBy) return { error: "This import row has already been approved. Revert it before approving again." };

  const direction = row.direction ?? "Gelir";

  if (row.linkedTransferAccountId) {
    if (row.linkedTransferAccountId === accountId) return { error: "Kaynak ve karşı hesap aynı olamaz." };
    const bankAmount = new Decimal(row.rawAmount);
    const signedBankAmount = direction === "Gider" ? bankAmount : bankAmount.negated();
    const description = row.rawDescription ?? "Banka transferi";
    await db.insert(transactions).values([
      {
        accountId,
        transactionType: "Transfer",
        amount: signedBankAmount.toFixed(2),
        transactionDate: row.rawDate,
        description,
        sourceImportId: stagingId,
      },
      {
        accountId: row.linkedTransferAccountId,
        transactionType: "Transfer",
        amount: signedBankAmount.negated().toFixed(2),
        transactionDate: row.rawDate,
        description: `Karşı transfer — ${description}`,
        sourceImportId: stagingId,
      },
    ]);

    await db.update(bankStatementImports).set({
      status: "Manuel Eşleşti",
      reconciledBy: session.user?.email ?? "unknown",
    }).where(eq(bankStatementImports.id, stagingId));

    revalidatePath("/bank-import");
    revalidatePath("/transactions");
    revalidatePath("/accounts");
    return { success: true };
  }

  // -----------------------------------------------------------------------
  // EXPENSE direction: record direct expense or vendor payment
  // -----------------------------------------------------------------------
  if (direction === "Gider") {
    if (!row.linkedVendorId) {
      // Direct expense without linked vendor
      await db.insert(transactions).values({
        accountId,
        transactionType: "Gider",
        amount: row.rawAmount,
        transactionDate: row.rawDate,
        description: row.rawDescription ?? null,
        sourceImportId: stagingId,
      });

      const finalStatus = row.status === "Otomatik Eşleşti" ? "Otomatik Eşleşti" : "Manuel Eşleşti";
      await db
        .update(bankStatementImports)
        .set({
          status: finalStatus,
          reconciledBy: session.user?.email ?? "unknown",
        })
        .where(eq(bankStatementImports.id, stagingId));

      revalidatePath("/bank-import");
      revalidatePath("/transactions");
      revalidatePath("/accounts");
      return { success: true };
    }

    const baseAmt = new Decimal(row.baseAmount ?? row.rawAmount);
    const surchargeAmt = new Decimal(row.surchargeAmount ?? "0");

    // 1. Insert base payment transaction (reduces what we owe the vendor)
    await db.insert(transactions).values({
      accountId,
      transactionType: "Gider",
      amount: baseAmt.toFixed(2),
      transactionDate: row.rawDate,
      vendorId: row.linkedVendorId, // linked to vendor now
      description: row.rawDescription ?? null,
      sourceImportId: stagingId,
    });

    // 2. If there is a surcharge (interest / penalty), insert a separate transaction
    if (!surchargeAmt.isZero() && row.surchargeType) {
      await db.insert(transactions).values({
        accountId,
        transactionType: "Gider",
        amount: surchargeAmt.toFixed(2),
        transactionDate: row.rawDate,
        vendorId: row.linkedVendorId,
        surchargeType: row.surchargeType,
        description: `${row.surchargeType} surcharge — ${row.rawDescription ?? ""}`.trim(),
        sourceImportId: stagingId,
      });
    }

    // 3. Mark staging row reconciled
    const finalStatus = row.status === "Otomatik Eşleşti" ? "Otomatik Eşleşti" : "Manuel Eşleşti";
    await db
      .update(bankStatementImports)
      .set({
        status: finalStatus,
        reconciledBy: session.user?.email ?? "unknown",
      })
      .where(eq(bankStatementImports.id, stagingId));

    revalidatePath("/bank-import");
    revalidatePath("/vendors");
    revalidatePath("/transactions");
    return { success: true };
  }

  // -----------------------------------------------------------------------
  // INCOME direction: record a resident payment or direct income
  // -----------------------------------------------------------------------
  if (row.linkedSplitInvoiceId && row.linkedInvoiceId && row.linkedInvoiceAmount) {
    const primaryAmount = new Decimal(row.linkedInvoiceAmount);
    const splitAmount = new Decimal(row.rawAmount).sub(primaryAmount);
    if (primaryAmount.lte(0) || splitAmount.lte(0)) {
      return { error: "Ödeme bölümü tutarları geçersiz. Eşleşmeyi yeniden düzenleyin." };
    }
    await db.transaction(async (tx) => {
      await tx.insert(transactions).values([
        {
          accountId,
          transactionType: "Gelir",
          amount: primaryAmount.toFixed(2),
          transactionDate: row.rawDate,
          relatedInvoiceId: row.linkedInvoiceId,
          description: `${row.rawDescription ?? "Banka ödemesi"} (birinci dönem payı)`,
          sourceImportId: stagingId,
        },
        {
          accountId,
          transactionType: "Gelir",
          amount: splitAmount.toFixed(2),
          transactionDate: row.rawDate,
          relatedInvoiceId: row.linkedSplitInvoiceId,
          description: `${row.rawDescription ?? "Banka ödemesi"} (ikinci dönem payı)`,
          sourceImportId: stagingId,
        },
      ]);
      await tx.update(bankStatementImports).set({
        status: "Manuel Eşleşti",
        reconciledBy: session.user?.email ?? "unknown",
      }).where(eq(bankStatementImports.id, stagingId));
    });
    revalidatePath("/bank-import");
    revalidatePath("/transactions");
    revalidatePath("/accounts");
    revalidatePath("/debts");
    return { success: true };
  }

  if (!row.linkedInvoiceId) {
    // Direct income without linked invoice
    await db.insert(transactions).values({
      accountId,
      transactionType: "Gelir",
      amount: row.rawAmount,
      transactionDate: row.rawDate,
      description: row.rawDescription ?? null,
      sourceImportId: stagingId,
    });

    const finalStatus = row.status === "Otomatik Eşleşti" ? "Otomatik Eşleşti" : "Manuel Eşleşti";
    await db
      .update(bankStatementImports)
      .set({
        status: finalStatus,
        reconciledBy: session.user?.email ?? "unknown",
      })
      .where(eq(bankStatementImports.id, stagingId));

    revalidatePath("/bank-import");
    revalidatePath("/transactions");
    revalidatePath("/accounts");
    return { success: true };
  }

  await db.insert(transactions).values({
    accountId,
    transactionType: "Gelir",
    amount: row.rawAmount,
    transactionDate: row.rawDate,
    relatedInvoiceId: row.linkedInvoiceId,
    sourceImportId: stagingId,
  });

  await recalculateInvoicePayment(row.linkedInvoiceId);

  const finalStatus = row.status === "Otomatik Eşleşti" ? "Otomatik Eşleşti" : "Manuel Eşleşti";
  await db
    .update(bankStatementImports)
    .set({
      status: finalStatus,
      reconciledBy: session.user?.email ?? "unknown",
    })
    .where(eq(bankStatementImports.id, stagingId));

  revalidatePath("/bank-import");
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Income matching
// ---------------------------------------------------------------------------

export async function manualMatch(stagingId: number, invoiceId: number) {
  const session = await auth();
  if (!session) return { error: "Unauthorized" };
  await db
    .update(bankStatementImports)
    .set({
      linkedInvoiceId: invoiceId,
      linkedSplitInvoiceId: null,
      linkedInvoiceAmount: null,
      linkedVendorId: null,
      linkedTransferAccountId: null,
      status: "Manuel Eşleşti",
      direction: "Gelir",
    })
    .where(eq(bankStatementImports.id, stagingId));
  revalidatePath("/bank-import");
  return { success: true };
}

export async function manualSplitMatch(
  stagingId: number,
  firstInvoiceId: number,
  secondInvoiceId: number,
  firstAmount: number,
) {
  const session = await auth();
  if (!session) return { error: "Unauthorized" };
  const parsed = z.object({
    stagingId: z.number().int().positive(),
    firstInvoiceId: z.number().int().positive(),
    secondInvoiceId: z.number().int().positive().refine((id) => id !== firstInvoiceId),
    firstAmount: z.number().positive(),
  }).safeParse({ stagingId, firstInvoiceId, secondInvoiceId, firstAmount });
  if (!parsed.success) return { error: "İki farklı dönem ve geçerli bir tutar seçin." };

  const [row] = await db.select().from(bankStatementImports)
    .where(eq(bankStatementImports.id, stagingId)).limit(1);
  if (!row) return { error: "Yükleme satırı bulunamadı." };
  if (row.reconciledBy) return { error: "Onaylanmış ödeme önce geri alınmalıdır." };
  if (new Decimal(firstAmount).gte(row.rawAmount)) {
    return { error: "İlk tutar, toplam ödemeden küçük olmalıdır." };
  }

  const targets = await db.select({
    id: monthlyInvoices.id,
    flatId: monthlyInvoices.flatId,
    periodType: billingPeriods.periodType,
  }).from(monthlyInvoices)
    .innerJoin(billingPeriods, eq(billingPeriods.id, monthlyInvoices.periodId))
    .where(inArray(monthlyInvoices.id, [firstInvoiceId, secondInvoiceId]));
  if (targets.length !== 2 || targets[0].flatId !== targets[1].flatId) {
    return { error: "Bölünen iki fatura aynı daireye ait olmalıdır." };
  }
  if (targets[0].periodType === targets[1].periodType) {
    return { error: "Ödeme bölme işlemi aylık aidat ve ek dönem arasında yapılmalıdır." };
  }

  await db.update(bankStatementImports).set({
    linkedInvoiceId: firstInvoiceId,
    linkedSplitInvoiceId: secondInvoiceId,
    linkedInvoiceAmount: new Decimal(firstAmount).toFixed(2),
    linkedVendorId: null,
    linkedTransferAccountId: null,
    direction: "Gelir",
    status: "Manuel Eşleşti",
  }).where(eq(bankStatementImports.id, stagingId));
  revalidatePath("/bank-import");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Direct match (Income or Expense without link)
// ---------------------------------------------------------------------------

export async function directMatch(
  stagingId: number,
  direction: "Gelir" | "Gider" | "Transfer",
  description: string,
  transferAccountId?: number,
) {
  const session = await auth();
  if (!session) return { error: "Unauthorized" };
  const [row] = await db.select().from(bankStatementImports)
    .where(eq(bankStatementImports.id, stagingId)).limit(1);
  if (!row) return { error: "Staging row not found." };

  if (direction === "Transfer") {
    const parsed = z.number().int().positive().safeParse(transferAccountId);
    if (!parsed.success) return { error: "Karşı hesap seçin." };
    const [target] = await db.select({ id: accounts.id }).from(accounts)
      .where(eq(accounts.id, parsed.data)).limit(1);
    if (!target) return { error: "Karşı hesap bulunamadı." };
    await db.update(bankStatementImports).set({
      status: "Manuel Eşleşti",
      direction: row.direction ?? "Gelir",
      rawDescription: description,
      linkedInvoiceId: null,
      linkedSplitInvoiceId: null,
      linkedInvoiceAmount: null,
      linkedPayableId: null,
      linkedVendorId: null,
      linkedTransferAccountId: parsed.data,
    }).where(eq(bankStatementImports.id, stagingId));
  } else {
    await db
      .update(bankStatementImports)
      .set({
        status: "Manuel Eşleşti",
        direction,
        rawDescription: description, // Save description to row so it's used when creating transaction
        linkedInvoiceId: null,
        linkedSplitInvoiceId: null,
        linkedInvoiceAmount: null,
        linkedPayableId: null,
        linkedVendorId: null,
        linkedTransferAccountId: null,
      })
      .where(eq(bankStatementImports.id, stagingId));
  }
  revalidatePath("/bank-import");
  return { success: true };
}

export async function unmatchStagingRow(stagingId: number) {
  await db
    .update(bankStatementImports)
    .set({
      status: "Bekliyor",
      direction: null, // Allow direction to be reset or keep default
      linkedInvoiceId: null,
      linkedSplitInvoiceId: null,
      linkedInvoiceAmount: null,
      linkedPayableId: null,
      linkedVendorId: null,
      linkedTransferAccountId: null,
      baseAmount: null,
      surchargeAmount: null,
      surchargeType: null,
    })
    .where(eq(bankStatementImports.id, stagingId));
  revalidatePath("/bank-import");
  return { success: true };
}

export async function revertStagingRow(stagingId: number) {
  const session = await auth();
  if (!session) return { error: "Unauthorized" };
  return rollbackImportRows([stagingId], false);
}

// ---------------------------------------------------------------------------
// Expense matching: link a staging row to a vendor directly
// ---------------------------------------------------------------------------

export async function linkVendorToStagingRow(
  stagingId: number,
  vendorId: number,
  baseAmount: number,
  surchargeAmount?: number,
  surchargeType?: "Faiz" | "Ceza" | "Ücret" | "Yuvarlama",
) {
  const schema = z.object({
    vendorId: z.number().int().positive(),
    baseAmount: z.number().min(0),
    surchargeAmount: z.number().min(0).optional(),
    surchargeType: z.enum(["Faiz", "Ceza", "Ücret", "Yuvarlama"]).optional(),
  });

  const parsed = schema.safeParse({ vendorId, baseAmount, surchargeAmount, surchargeType });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await db
    .update(bankStatementImports)
    .set({
      direction: "Gider",
      linkedInvoiceId: null,
      linkedVendorId: vendorId,
      linkedSplitInvoiceId: null,
      linkedInvoiceAmount: null,
      linkedTransferAccountId: null,
      baseAmount: baseAmount.toFixed(2),
      surchargeAmount: surchargeAmount ? surchargeAmount.toFixed(2) : null,
      surchargeType: surchargeType ?? null,
      status: "Manuel Eşleşti",
    })
    .where(eq(bankStatementImports.id, stagingId));

  revalidatePath("/bank-import");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

export async function ignoreStagingRow(stagingId: number) {
  await db
    .update(bankStatementImports)
    .set({ status: "Yok Sayıldı" })
    .where(eq(bankStatementImports.id, stagingId));
  revalidatePath("/bank-import");
  return { success: true };
}

export async function deleteStagingBatch(batchId: string) {
  const session = await auth();
  if (!session) return { error: "Unauthorized" };
  const rows = await db.select({ id: bankStatementImports.id })
    .from(bankStatementImports).where(eq(bankStatementImports.batchId, batchId));
  return rollbackImportRows(rows.map((row) => row.id), true);
}
