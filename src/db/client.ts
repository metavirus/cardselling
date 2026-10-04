import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalDatabase = globalThis as unknown as { cardsellingPool?: Pool };
export function database() {
  if (!process.env.DATABASE_URL) throw new Error("Database configuration is missing.");
  globalDatabase.cardsellingPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 3000
  });
  return drizzle(globalDatabase.cardsellingPool, { schema });
}
