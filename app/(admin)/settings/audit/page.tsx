import { eq, desc } from "drizzle-orm";
import { requireRole } from "@/lib/auth/require-role";
import { db } from "@/lib/db";
import { auditLog, users } from "@/lib/db/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AuditLogPage() {
  await requireRole("admin");

  const rows = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      module: auditLog.module,
      recordId: auditLog.recordId,
      summary: auditLog.summary,
      changes: auditLog.changes,
      createdAt: auditLog.createdAt,
      userName: users.fullName,
    })
    .from(auditLog)
    .innerJoin(users, eq(users.id, auditLog.userId))
    .orderBy(desc(auditLog.createdAt))
    .limit(300);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Audit Log</h1>
      <p className="text-sm text-muted-foreground">Read-only — there is no delete path at any permission level.</p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Timestamp</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Module</TableHead>
            <TableHead>Summary</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            let changeEntries: [string, [unknown, unknown]][] = [];
            if (r.changes) {
              try {
                changeEntries = Object.entries(JSON.parse(r.changes) as Record<string, [unknown, unknown]>);
              } catch {
                changeEntries = [];
              }
            }
            return (
              <TableRow key={r.id}>
                <TableCell>{new Date(r.createdAt * 1000).toLocaleString("en-PK")}</TableCell>
                <TableCell>{r.userName}</TableCell>
                <TableCell className="capitalize">{r.action}</TableCell>
                <TableCell className="capitalize">{r.module}</TableCell>
                <TableCell>
                  <p>{r.summary}</p>
                  {changeEntries.length > 0 && (
                    <ul className="mt-1 text-xs text-muted-foreground">
                      {changeEntries.map(([field, [before, after]]) => (
                        <li key={field}>
                          {field}: {String(before)} → {String(after)}
                        </li>
                      ))}
                    </ul>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No activity yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
