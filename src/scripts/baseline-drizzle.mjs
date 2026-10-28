import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set in .env");
}

const migrationsDir = "src/lib/db/migrations";
const journal = JSON.parse(await readFile(`${migrationsDir}/meta/_journal.json`, "utf8"));
const baselineEntry = journal.entries.find((entry) => entry.tag === "0006_pale_wilson_fisk");
if (!baselineEntry) throw new Error("Drizzle baseline migration 0006 was not found.");

const snapshot = JSON.parse(await readFile(`${migrationsDir}/meta/0006_snapshot.json`, "utf8"));
const migrationSql = await readFile(`${migrationsDir}/${baselineEntry.tag}.sql`, "utf8");
const baselineHash = createHash("sha256").update(migrationSql).digest("hex");
const sql = postgres(process.env.DATABASE_URL, { prepare: false });

try {
  const liveColumns = await sql`
    SELECT table_schema, table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
  `;
  const actual = new Set(liveColumns.map((column) => `${column.table_schema}.${column.table_name}.${column.column_name}`));
  const missing = [];

  for (const [qualifiedTable, table] of Object.entries(snapshot.tables)) {
    for (const column of Object.values(table.columns)) {
      const qualifiedColumn = `${qualifiedTable}.${column.name}`;
      if (!actual.has(qualifiedColumn)) missing.push(qualifiedColumn);
    }
  }

  if (missing.length) {
    throw new Error(`Database does not match the existing 0006 schema; missing: ${missing.join(", ")}`);
  }

  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;

  const [latest] = await sql`
    SELECT created_at
    FROM drizzle.__drizzle_migrations
    ORDER BY created_at DESC
    LIMIT 1
  `;
  if (latest) {
    if (BigInt(latest.created_at) < BigInt(baselineEntry.when)) {
      throw new Error("Migration history is partially applied. Baseline was not changed.");
    }
    console.log("Drizzle migration history already includes the 0006 baseline.");
  } else {
    await sql`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES (${baselineHash}, ${baselineEntry.when})
    `;
    console.log("Existing database verified and baselined at Drizzle migration 0006.");
  }
} finally {
  await sql.end();
}
