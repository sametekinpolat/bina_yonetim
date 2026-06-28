"use server";

import { db } from "@/lib/db";
import { expenseCategories, expensePresets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const categorySchema = z.object({ name: z.string().min(1).max(100) });

const presetSchema = z.object({
  name: z.string().min(1).max(100),
  defaultAmount: z.coerce.number().positive(),
  categoryId: z.coerce.number().int().positive(),
});

export async function createCategory(formData: FormData) {
  const parsed = categorySchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await db.insert(expenseCategories).values(parsed.data);
    revalidatePath("/expenses");
    return { success: true };
  } catch {
    return { error: "Category name already exists." };
  }
}

export async function updateCategory(id: number, formData: FormData) {
  const parsed = categorySchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await db.update(expenseCategories).set(parsed.data).where(eq(expenseCategories.id, id));
    revalidatePath("/expenses");
    return { success: true };
  } catch {
    return { error: "Category name already exists." };
  }
}

export async function deleteCategory(id: number) {
  try {
    await db.delete(expenseCategories).where(eq(expenseCategories.id, id));
    revalidatePath("/expenses");
    return { success: true };
  } catch {
    return { error: "Cannot delete — category may have linked records." };
  }
}

export async function createPreset(formData: FormData) {
  const parsed = presetSchema.safeParse({
    name: formData.get("name"),
    defaultAmount: formData.get("defaultAmount"),
    categoryId: formData.get("categoryId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await db.insert(expensePresets).values({
      ...parsed.data,
      defaultAmount: parsed.data.defaultAmount.toString(),
    });
    revalidatePath("/expenses");
    return { success: true };
  } catch {
    return { error: "Failed to create preset." };
  }
}

export async function updatePreset(id: number, formData: FormData) {
  const parsed = presetSchema.safeParse({
    name: formData.get("name"),
    defaultAmount: formData.get("defaultAmount"),
    categoryId: formData.get("categoryId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await db.update(expensePresets).set({
      ...parsed.data,
      defaultAmount: parsed.data.defaultAmount.toString(),
    }).where(eq(expensePresets.id, id));
    revalidatePath("/expenses");
    return { success: true };
  } catch {
    return { error: "Failed to update preset." };
  }
}

export async function deletePreset(id: number) {
  try {
    await db.delete(expensePresets).where(eq(expensePresets.id, id));
    revalidatePath("/expenses");
    return { success: true };
  } catch {
    return { error: "Failed to delete preset." };
  }
}
