import { db } from "@/lib/db";
import { flats, flatRelationships, people } from "@/lib/db/schema";
import { eq, isNull } from "drizzle-orm";
import { FlatsTable } from "@/components/admin/flats/flats-table";

export default async function FlatsPage() {
  const allFlats = await db.select().from(flats).orderBy(flats.flatNumber);

  const activeRelationships = await db
    .select({
      flatId: flatRelationships.flatId,
      role: flatRelationships.role,
      firstName: people.firstName,
      lastName: people.lastName,
    })
    .from(flatRelationships)
    .innerJoin(people, eq(people.id, flatRelationships.personId))
    .where(isNull(flatRelationships.moveOutDate));

  const flatsWithResidents = allFlats.map((flat) => ({
    ...flat,
    residents: activeRelationships
      .filter((r) => r.flatId === flat.id)
      .map((r) => ({ name: `${r.firstName} ${r.lastName}`, role: r.role })),
  }));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Daireler</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Binanın dairelerini ve sakinlerini yönetin.
      </p>
      <FlatsTable flats={flatsWithResidents} />
    </div>
  );
}
