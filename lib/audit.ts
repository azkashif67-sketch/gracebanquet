import { nanoid } from "nanoid";
import { auditLog } from "./db/schema";
import type { Transaction } from "./calculations";

export interface AuditParams {
  userId: string;
  action: string; // create|update|delete|cancel|restore|login|login_fail|payment|export
  module: string; // booking|service|expense|payment|user|settings|auth|tax
  recordId?: string;
  summary: string;
  changes?: Record<string, [unknown, unknown]>;
  ip?: string;
}

// Must be called with the same transaction as the mutation it describes — if
// the mutation rolls back, the audit row must roll back with it.
export async function audit(tx: Transaction, params: AuditParams): Promise<void> {
  await tx.insert(auditLog).values({
    id: nanoid(),
    userId: params.userId,
    action: params.action,
    module: params.module,
    recordId: params.recordId,
    summary: params.summary,
    changes: params.changes ? JSON.stringify(params.changes) : null,
    ip: params.ip,
    createdAt: Math.floor(Date.now() / 1000),
  });
}

export function diff<T extends Record<string, unknown>>(
  before: T,
  after: T,
): Record<string, [unknown, unknown]> {
  const changes: Record<string, [unknown, unknown]> = {};
  for (const k of Object.keys(after) as (keyof T)[]) {
    if (before[k] !== after[k]) {
      changes[k as string] = [before[k], after[k]];
    }
  }
  return changes;
}
