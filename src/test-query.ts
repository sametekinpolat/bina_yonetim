import "dotenv/config";
import { db } from "./lib/db";
import { billingPeriods } from "./lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const result = await db.select().from(billingPeriods).where(eq(billingPeriods.id, 5));
  console.log("Period with ID 5:", result);
  const all = await db.select().from(billingPeriods);
  console.log("All periods:", all.map(p => ({ id: p.id, name: p.periodName })));
}
main().catch(console.error);
