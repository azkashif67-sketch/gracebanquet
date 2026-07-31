import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

// Cache the client across Next.js dev hot-reloads so we don't open a new
// libSQL connection (and re-run PRAGMA) on every module re-evaluation.
const globalForDb = globalThis as unknown as {
  __libsqlClient?: Client;
  __pragmaReady?: Promise<unknown>;
};

const client =
  globalForDb.__libsqlClient ??
  createClient({
    url: process.env.TURSO_DATABASE_URL ?? "file:./local.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__libsqlClient = client;
}

// libSQL does not enable foreign key enforcement by default. busy_timeout lets
// concurrent writers on a local file queue briefly instead of failing fast
// with SQLITE_BUSY (irrelevant against hosted Turso, harmless to set anyway).
globalForDb.__pragmaReady ??= client
  .execute("PRAGMA foreign_keys = ON")
  .then(() => client.execute("PRAGMA busy_timeout = 5000"));

export const db = drizzle(client, { schema });
export type Db = typeof db;
