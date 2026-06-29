import { config } from "dotenv";
config({ path: ".env", override: true });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users } from "../lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;
const NAME = process.env.ADMIN_NAME || "Admin";

async function main() {
  if (!EMAIL || !PASSWORD) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.");
  }
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db = drizzle(client);

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, EMAIL))
    .limit(1);

  if (existing.length > 0) {
    console.log(`Admin user already exists (email: ${EMAIL}). Nothing to do.`);
    await client.end();
    return;
  }

  const hash = await bcrypt.hash(PASSWORD, 12);
  await db.insert(users).values({
    email: EMAIL,
    name: NAME,
    passwordHash: hash,
    role: "SüperAdmin",
  });

  console.log("✓ Admin user created:");
  console.log(`  Email:    ${EMAIL}`);
  console.log(`  Password: ${PASSWORD}`);
  console.log("  Role:     SüperAdmin");
  console.log("\nChange the password after first login!");

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
