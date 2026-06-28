"use server";

import { db } from "@/lib/db";
import { vendors } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const vendorSchema = z.object({
  name: z.string().min(1).max(200),
  vendorType: z.enum(["Şirket", "Personel", "Kamu"]),
  contactInfo: z.string().optional().nullable(),
  iban: z.string().max(34).optional().nullable(),
});

export async function createVendor(formData: FormData) {
  const parsed = vendorSchema.safeParse({
    name: formData.get("name"),
    vendorType: formData.get("vendorType"),
    contactInfo: formData.get("contactInfo") || null,
    iban: formData.get("iban") || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await db.insert(vendors).values(parsed.data);
    revalidatePath("/vendors");
    return { success: true };
  } catch {
    return { error: "Failed to create vendor." };
  }
}

export async function updateVendor(id: number, formData: FormData) {
  const parsed = vendorSchema.safeParse({
    name: formData.get("name"),
    vendorType: formData.get("vendorType"),
    contactInfo: formData.get("contactInfo") || null,
    iban: formData.get("iban") || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await db.update(vendors).set(parsed.data).where(eq(vendors.id, id));
    revalidatePath("/vendors");
    return { success: true };
  } catch {
    return { error: "Failed to update vendor." };
  }
}

export async function deleteVendor(id: number) {
  try {
    await db.delete(vendors).where(eq(vendors.id, id));
    revalidatePath("/vendors");
    return { success: true };
  } catch {
    return { error: "Cannot delete — vendor may have linked expenses." };
  }
}
