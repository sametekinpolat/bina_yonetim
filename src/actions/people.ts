"use server";

import { db } from "@/lib/db";
import { people, flatRelationships } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const personSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phoneNumber: z.string().max(30).optional().nullable(),
  email: z.string().email().optional().or(z.literal("")),
});

const relationshipSchema = z.object({
  flatId: z.coerce.number().int().positive(),
  role: z.enum(["Ev Sahibi", "Kiracı"]),
  moveInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  moveOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
});

export async function createPerson(formData: FormData) {
  const parsed = personSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phoneNumber: formData.get("phoneNumber") || null,
    email: formData.get("email") || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const [person] = await db
      .insert(people)
      .values({
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        phoneNumber: parsed.data.phoneNumber ?? null,
        email: parsed.data.email || null,
      })
      .returning();
    revalidatePath("/residents");
    return { success: true, id: person.id };
  } catch {
    return { error: "Failed to create person." };
  }
}

export async function updatePerson(id: number, formData: FormData) {
  const parsed = personSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phoneNumber: formData.get("phoneNumber") || null,
    email: formData.get("email") || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await db
      .update(people)
      .set({
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        phoneNumber: parsed.data.phoneNumber ?? null,
        email: parsed.data.email || null,
      })
      .where(eq(people.id, id));
    revalidatePath("/residents");
    return { success: true };
  } catch {
    return { error: "Failed to update person." };
  }
}

export async function deletePerson(id: number) {
  try {
    await db.delete(people).where(eq(people.id, id));
    revalidatePath("/residents");
    return { success: true };
  } catch {
    return { error: "Cannot delete — person may have linked records." };
  }
}

export async function createRelationship(personId: number, formData: FormData) {
  const parsed = relationshipSchema.safeParse({
    flatId: formData.get("flatId"),
    role: formData.get("role"),
    moveInDate: formData.get("moveInDate"),
    moveOutDate: formData.get("moveOutDate") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await db.insert(flatRelationships).values({
      personId,
      flatId: parsed.data.flatId,
      role: parsed.data.role,
      moveInDate: parsed.data.moveInDate,
      moveOutDate: parsed.data.moveOutDate || null,
    });
    revalidatePath("/residents");
    revalidatePath("/flats");
    return { success: true };
  } catch {
    return { error: "Failed to create relationship." };
  }
}

export async function updateRelationship(id: number, formData: FormData) {
  const parsed = relationshipSchema.safeParse({
    flatId: formData.get("flatId"),
    role: formData.get("role"),
    moveInDate: formData.get("moveInDate"),
    moveOutDate: formData.get("moveOutDate") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await db
      .update(flatRelationships)
      .set({
        flatId: parsed.data.flatId,
        role: parsed.data.role,
        moveInDate: parsed.data.moveInDate,
        moveOutDate: parsed.data.moveOutDate || null,
      })
      .where(eq(flatRelationships.id, id));
    revalidatePath("/residents");
    revalidatePath("/flats");
    return { success: true };
  } catch {
    return { error: "Failed to update relationship." };
  }
}

export async function deleteRelationship(id: number) {
  try {
    await db.delete(flatRelationships).where(eq(flatRelationships.id, id));
    revalidatePath("/residents");
    revalidatePath("/flats");
    return { success: true };
  } catch {
    return { error: "Failed to delete relationship." };
  }
}
