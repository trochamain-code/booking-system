import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function createDb(): PostgresJsDatabase<typeof schema> {
  // Load .env when run outside Next (seed scripts, drizzle-kit). Next loads it itself.
  try {
    process.loadEnvFile();
  } catch {
    // no .env file — rely on real env vars
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  // Reuse the client across HMR reloads in dev to avoid exhausting connections.
  const globalForDb = globalThis as unknown as { _pg?: ReturnType<typeof postgres> };
  const client = globalForDb._pg ?? postgres(url);
  if (process.env.NODE_ENV !== "production") globalForDb._pg = client;

  return drizzle(client, { schema });
}

let _db: PostgresJsDatabase<typeof schema> | undefined;

const handler: ProxyHandler<PostgresJsDatabase<typeof schema>> = {
  get(_, prop) {
    if (!_db) _db = createDb();
    return Reflect.get(_db, prop);
  },
};

export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, handler);
