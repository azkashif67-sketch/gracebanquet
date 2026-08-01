import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { getReceivablesAged, type ReceivableRow } from "@/lib/db/queries/bookings";
import { formatPKR } from "@/lib/calculations";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const BUCKET_LABEL: Record<ReceivableRow["bucket"], string> = {
  not_yet_due: "Not yet due",
  "1_7": "1–7 days overdue",
  "8_30": "8–30 days overdue",
  "30_plus": "30+ days overdue",
};

const BUCKET_VARIANT: Record<ReceivableRow["bucket"], "secondary" | "default" | "destructive"> = {
  not_yet_due: "secondary",
  "1_7": "default",
  "8_30": "destructive",
  "30_plus": "destructive",
};

export default async function ReceivablesReportPage() {
  await requireRole("admin", "manager");
  const rows = await getReceivablesAged();

  const sorted = [...rows].sort((a, b) => b.daysOverdue - a.daysOverdue);
  const totalReceivable = rows.reduce((s, r) => s + r.balanceDue, 0);
  const totalOverdue = rows.filter((r) => r.daysOverdue > 0).reduce((s, r) => s + r.balanceDue, 0);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Outstanding Receivables</h1>
      <p className="text-sm text-muted-foreground">
        This is the money-collection worklist — sorted by days overdue, phone numbers included so it
        can be worked through directly.
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Client</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Event Date</TableHead>
            <TableHead>Balance</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((r) => (
            <TableRow key={r.id} className={r.daysOverdue > 0 ? "bg-red-50 dark:bg-red-950/20" : ""}>
              <TableCell>
                <Link href={`/bookings/${r.id}`} className="text-primary hover:underline">
                  {r.clientName}
                </Link>
                <div className="text-xs text-muted-foreground">{r.invoiceNo}</div>
              </TableCell>
              <TableCell>{r.phone}</TableCell>
              <TableCell>{r.eventDate}</TableCell>
              <TableCell>{formatPKR(r.balanceDue)}</TableCell>
              <TableCell>{r.dueDate ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={BUCKET_VARIANT[r.bucket]}>{BUCKET_LABEL[r.bucket]}</Badge>
              </TableCell>
            </TableRow>
          ))}
          {sorted.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No outstanding balances.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <p className="text-sm text-muted-foreground">
        Total receivable {formatPKR(totalReceivable)} · Total overdue {formatPKR(totalOverdue)}
      </p>
    </div>
  );
}
