"use server";

import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const accountSchema = z.object({
  accountName: z.string().min(1).max(200),
  accountType: z.enum(["Banka", "Kasa"]),
});

export async function createAccount(formData: FormData) {
  const parsed = accountSchema.safeParse({
    accountName: formData.get("accountName"),
    accountType: formData.get("accountType"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await db.insert(accounts).values(parsed.data);
    revalidatePath("/accounts");
    return { success: true };
  } catch {
    return { error: "Failed to create account." };
  }
}

export async function updateAccount(id: number, formData: FormData) {
  const parsed = accountSchema.safeParse({
    accountName: formData.get("accountName"),
    accountType: formData.get("accountType"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await db.update(accounts).set(parsed.data).where(eq(accounts.id, id));
    revalidatePath("/accounts");
    return { success: true };
  } catch {
    return { error: "Failed to update account." };
  }
}

export async function deleteAccount(id: number) {
  try {
    await db.delete(accounts).where(eq(accounts.id, id));
    revalidatePath("/accounts");
    return { success: true };
  } catch {
    return { error: "Cannot delete — account has linked transactions." };
  }
}
