import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { listInvoices, type PaymentStatus } from "@/lib/db/queries/invoices";
import { formatPKR } from "@/lib/calculations";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_LABEL: Record<PaymentStatus, string> = {
  paid: "Paid in Full",
  partial: "Partial",
  unpaid: "Unpaid",
  overdue: "Overdue",
};

const STATUS_VARIANT: Record<PaymentStatus, "default" | "secondary" | "destructive"> = {
  paid: "default",
  partial: "secondary",
  unpaid: "secondary",
  overdue: "destructive",
};

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; from?: string; to?: string }>;
}) {
  await requireRole("admin");
  const params = await searchParams;
  const status =
    params.status && ["paid", "partial", "unpaid", "overdue"].includes(params.status)
      ? (params.status as PaymentStatus)
      : undefined;

  const rows = await listInvoices({
    search: params.q,
    paymentStatus: status,
    eventDateFrom: params.from,
    eventDateTo: params.to,
  });

  const totals = rows.reduce(
    (acc, r) => ({
      invoiced: acc.invoiced + r.grandTotal,
      collected: acc.collected + r.amountPaid,
      outstanding: acc.outstanding + r.balanceDue,
    }),
    { invoiced: 0, collected: 0, outstanding: 0 },
  );

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Invoices</h1>

      <form className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-muted-foreground">Search</label>
          <Input name="q" defaultValue={params.q} placeholder="Invoice #, client, phone" className="w-64" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-muted-foreground">Status</label>
          <select
            name="status"
            defaultValue={params.status ?? ""}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            <option value="">All</option>
            <option value="paid">Paid in Full</option>
            <option value="partial">Partial</option>
            <option value="unpaid">Unpaid</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-muted-foreground">Event from</label>
          <Input type="date" name="from" defaultValue={params.from} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-muted-foreground">Event to</label>
          <Input type="date" name="to" defaultValue={params.to} />
        </div>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice No</TableHead>
            <TableHead>Date Issued</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Event Date</TableHead>
            <TableHead>Grand Total</TableHead>
            <TableHead>Paid</TableHead>
            <TableHead>Balance</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} className={r.paymentStatus === "overdue" ? "bg-red-50 dark:bg-red-950/20" : ""}>
              <TableCell>
                <Link href={`/bookings/${r.id}`} className="text-primary hover:underline">
                  {r.invoiceNo}
                </Link>
              </TableCell>
              <TableCell>{new Date(r.createdAt * 1000).toLocaleDateString("en-PK")}</TableCell>
              <TableCell>
                {r.clientName}
                <div className="text-xs text-muted-foreground">{r.phone}</div>
              </TableCell>
              <TableCell>{r.eventDate}</TableCell>
              <TableCell>{formatPKR(r.grandTotal)}</TableCell>
              <TableCell>{formatPKR(r.amountPaid)}</TableCell>
              <TableCell>{formatPKR(r.balanceDue)}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[r.paymentStatus]}>{STATUS_LABEL[r.paymentStatus]}</Badge>
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                No invoices match these filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <p className="text-sm text-muted-foreground">
        Showing {rows.length} invoice{rows.length === 1 ? "" : "s"} · Total {formatPKR(totals.invoiced)} · Collected{" "}
        {formatPKR(totals.collected)} · Outstanding {formatPKR(totals.outstanding)}
      </p>
    </div>
  );
}
