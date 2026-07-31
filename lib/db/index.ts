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

const isLocalFile = (process.env.TURSO_DATABASE_URL ?? "file:./local.db").startsWith("file:");

// libSQL does not enable foreign key enforcement by default — needed against
// both a local file and hosted Turso. busy_timeout only matters for a local
// file's single-writer lock contention; Turso's remote server (a) handles
// concurrency itself and (b) rejects some PRAGMAs outright over its wire
// protocol (SQL_PARSE_ERROR), so only send it when talking to a local file.
// Never let a startup PRAGMA failure become an unhandled rejection that can
// crash the whole process — log and move on.
globalForDb.__pragmaReady ??= (async () => {
  try {
    await client.execute("PRAGMA foreign_keys = ON");
    if (isLocalFile) {
      await client.execute("PRAGMA busy_timeout = 5000");
    }
  } catch (err) {
    console.error("Startup PRAGMA failed (continuing anyway):", err);
  }
})();

export const db = drizzle(client, { schema });
export type Db = typeof db;
