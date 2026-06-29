"use server";

import { db } from "@/lib/db";
import { flats } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const flatSchema = z.object({
  flatNumber: z.coerce.number().int().min(1).max(999),
  sizeSqm: z.coerce.number().min(0).optional().nullable(),
  waterTier: z.enum(["Tam", "Düşük", "Yok"]),
  isEmpty: z.coerce.boolean().optional(),
});

export async function createFlat(formData: FormData) {
  const parsed = flatSchema.safeParse({
    flatNumber: formData.get("flatNumber"),
    sizeSqm: formData.get("sizeSqm") || null,
    waterTier: formData.get("waterTier") || "Tam",
    isEmpty: formData.get("isEmpty") === "on" || formData.get("isEmpty") === "true",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await db.insert(flats).values({
      flatNumber: parsed.data.flatNumber,
      sizeSqm: parsed.data.sizeSqm?.toString() ?? null,
      waterTier: parsed.data.waterTier,
      isEmpty: parsed.data.isEmpty,
    });
    revalidatePath("/flats");
    return { success: true };
  } catch {
    return { error: "A flat with this number already exists." };
  }
}

export async function updateFlat(id: number, formData: FormData) {
  const parsed = flatSchema.safeParse({
    flatNumber: formData.get("flatNumber"),
    sizeSqm: formData.get("sizeSqm") || null,
    waterTier: formData.get("waterTier") || "Tam",
    isEmpty: formData.get("isEmpty") === "on" || formData.get("isEmpty") === "true",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await db
      .update(flats)
      .set({
        flatNumber: parsed.data.flatNumber,
        sizeSqm: parsed.data.sizeSqm?.toString() ?? null,
        waterTier: parsed.data.waterTier,
        isEmpty: parsed.data.isEmpty,
      })
      .where(eq(flats.id, id));
    revalidatePath("/flats");
    return { success: true };
  } catch {
    return { error: "A flat with this number already exists." };
  }
}

export async function deleteFlat(id: number) {
  try {
    await db.delete(flats).where(eq(flats.id, id));
    revalidatePath("/flats");
    return { success: true };
  } catch {
    return { error: "Cannot delete flat — it may have linked records." };
  }
}
