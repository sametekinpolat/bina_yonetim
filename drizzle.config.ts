import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

config({ path: ".env", override: true });

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./src/lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
