import { db } from "../lib/db";
import { billingPeriods } from "../lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const result = await db.select().from(billingPeriods).where(eq(billingPeriods.id, 5));
  console.log(result);
}
main();
