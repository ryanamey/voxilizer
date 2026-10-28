import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Local commands (db:migrate, db:studio) read the development values from .env.local.
config({ path: ".env.local", quiet: true });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  // Only manage our own schema; Neon Auth owns `neon_auth`.
  schemaFilter: ["public"],
  strict: true,
  verbose: true,
});
