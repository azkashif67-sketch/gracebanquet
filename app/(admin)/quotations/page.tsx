import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { listQuotations, type QuotationStatus } from "@/lib/db/queries/quotations";
import { formatPKR } from "@/lib/calculations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_VARIANT: Record<QuotationStatus, "default" | "secondary" | "destructive"> = {
  draft: "secondary",
  sent: "default",
  accepted: "default",
  expired: "destructive",
  declined: "destructive",
  converted: "secondary",
};

export default async function QuotationsPage() {
  const user = await requireRole("admin");
  const canCreate = user.role === "admin" || user.role === "manager";
  const rows = await listQuotations();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Quotations</h1>
        {canCreate && <Button render={<Link href="/quotations/new">New Quotation</Link>} />}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Quote No</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Event Pref</TableHead>
            <TableHead>Guests</TableHead>
            <TableHead>Grand Total</TableHead>
            <TableHead>Valid Until</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((q) => (
            <TableRow key={q.id}>
              <TableCell>
                <Link href={`/quotations/${q.id}`} className="text-primary hover:underline">
                  {q.quoteNo}
                </Link>
              </TableCell>
              <TableCell>{q.clientName}</TableCell>
              <TableCell>{q.eventDatePref ?? "—"}</TableCell>
              <TableCell>{q.guestCount ?? "—"}</TableCell>
              <TableCell>{formatPKR(q.grandTotal)}</TableCell>
              <TableCell>{q.validUntil}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[q.displayStatus]} className="capitalize">
                  {q.displayStatus}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                No quotations yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
