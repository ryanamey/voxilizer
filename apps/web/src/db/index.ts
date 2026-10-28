import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { serverEnv } from "@/lib/env";
import * as schema from "./schema";

type Db = NeonHttpDatabase<typeof schema>;

let instance: Db | null = null;

/** Drizzle client over Neon's HTTP driver (ideal for serverless). Created on first use. */
export function getDb(): Db {
  if (!instance) instance = drizzle(neon(serverEnv().DATABASE_URL), { schema });
  return instance;
}

export { schema };
