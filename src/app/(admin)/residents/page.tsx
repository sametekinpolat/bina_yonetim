import { db } from "@/lib/db";
import { people, flatRelationships, flats } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ResidentsTable } from "@/components/admin/residents/residents-table";

export default async function ResidentsPage() {
  const allPeople = await db.select().from(people).orderBy(people.lastName, people.firstName);
  const allFlats = await db.select({ id: flats.id, flatNumber: flats.flatNumber }).from(flats).orderBy(flats.flatNumber);
  const allRelationships = await db
    .select({
      id: flatRelationships.id,
      personId: flatRelationships.personId,
      flatId: flatRelationships.flatId,
      flatNumber: flats.flatNumber,
      role: flatRelationships.role,
      moveInDate: flatRelationships.moveInDate,
      moveOutDate: flatRelationships.moveOutDate,
    })
    .from(flatRelationships)
    .innerJoin(flats, eq(flats.id, flatRelationships.flatId))
    .orderBy(flatRelationships.moveInDate);

  const peopleWithRelationships = allPeople.map((person) => ({
    ...person,
    relationships: allRelationships
      .filter((r) => r.personId === person.id)
      .map((r) => ({
        id: r.id,
        flatId: r.flatId,
        flatNumber: r.flatNumber,
        role: r.role as "Ev Sahibi" | "Kiracı",
        moveInDate: r.moveInDate,
        moveOutDate: r.moveOutDate,
      })),
  }));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Sakinler</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Ev sahiplerini, kiracıları ve daire atamalarını yönetin.
      </p>
      <ResidentsTable people={peopleWithRelationships} flats={allFlats} />
    </div>
  );
}
