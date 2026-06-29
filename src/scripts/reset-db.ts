import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import "dotenv/config";

async function resetDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined in .env");
  }

  console.log("⚠️ Wiping the public schema to reset the database...");
  
  // Connect to the database
  const connectionString = process.env.DATABASE_URL;
  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);

  try {
    // Drop the public schema completely and recreate it.
    // This removes all tables, types, enums, and data inside it.
    await sql`DROP SCHEMA public CASCADE;`;
    await sql`CREATE SCHEMA public;`;
    
    // Also grant usage/create permissions back to public (postgres default)
    await sql`GRANT ALL ON SCHEMA public TO public;`;

    console.log("✅ Database wiped successfully!");
    console.log("👉 Now run: npx drizzle-kit push");
    console.log("👉 Then run: npm run seed:admin");
  } catch (error) {
    console.error("❌ Failed to reset database:", error);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

resetDatabase();
