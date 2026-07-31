import "server-only";
import { db } from "../index";

// Whether the first-run setup wizard has been completed (i.e. an admin
// account exists). Checked from individual pages rather than middleware —
// middleware runs on every request across the whole app and, on some
// platforms, may not reliably get the Node.js runtime a DB client needs;
// keeping this check page-local avoids that class of failure entirely.
export async function isSetupComplete(): Promise<boolean> {
  const existing = await db.query.users.findFirst({ columns: { id: true } });
  return Boolean(existing);
}
