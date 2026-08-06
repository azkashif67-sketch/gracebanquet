import { requireRole } from "@/lib/auth/require-role";
import { getRevenueReport } from "@/lib/db/queries/reports";
import { formatPKR } from "@/lib/calculations";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function RevenueReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; eventType?: string }>;
}) {
  await requireRole("admin");
  const params = await searchParams;

  const rows = await getRevenueReport({
    from: params.from,
    to: params.to,
    eventType: params.eventType,
  });

  const summary = rows.reduce(
    (acc, r) => ({
      bookings: acc.bookings + 1,
      gross: acc.gross + r.subtotal,
      discounts: acc.discounts + r.discountAmount,
      net: acc.net + (r.subtotal - r.discountAmount),
      collected: acc.collected + r.amountPaid,
      outstanding: acc.outstanding + r.balanceDue,
    }),
    { bookings: 0, gross: 0, discounts: 0, net: 0, collected: 0, outstanding: 0 },
  );
  const avgBookingValue = summary.bookings > 0 ? Math.round(summary.net / summary.bookings) : 0;

  const byEventType = new Map<string, { count: number; total: number }>();
  for (const r of rows) {
    const cur = byEventType.get(r.eventType) ?? { count: 0, total: 0 };
    cur.count += 1;
    cur.total += r.grandTotal;
    byEventType.set(r.eventType, cur);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Monthly Booking Revenue</h1>
      <p className="text-sm text-muted-foreground">
        Attributed by event date. Excludes cancelled and deleted bookings.
      </p>

      <form className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-muted-foreground">Event from</label>
          <Input type="date" name="from" defaultValue={params.from} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-muted-foreground">Event to</label>
          <Input type="date" name="to" defaultValue={params.to} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-muted-foreground">Event type</label>
          <Input name="eventType" defaultValue={params.eventType} placeholder="wedding, corporate…" />
        </div>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Total Bookings" value={String(summary.bookings)} />
        <SummaryCard label="Gross Revenue" value={formatPKR(summary.gross)} />
        <SummaryCard label="Discounts Given" value={formatPKR(summary.discounts)} />
        <SummaryCard label="Net Revenue" value={formatPKR(summary.net)} />
        <SummaryCard label="Collected" value={formatPKR(summary.collected)} />
        <SummaryCard label="Outstanding" value={formatPKR(summary.outstanding)} />
        <SummaryCard label="Avg Booking Value" value={formatPKR(avgBookingValue)} />
      </div>

      {byEventType.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By Event Type</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Bookings</TableHead>
                  <TableHead>Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...byEventType.entries()].map(([type, v]) => (
                  <TableRow key={type}>
                    <TableCell className="capitalize">{type}</TableCell>
                    <TableCell>{v.count}</TableCell>
                    <TableCell>{formatPKR(v.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice No</TableHead>
            <TableHead>Event Date</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Guests</TableHead>
            <TableHead>Gross</TableHead>
            <TableHead>Discount</TableHead>
            <TableHead>Tax</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Paid</TableHead>
            <TableHead>Balance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{r.invoiceNo}</TableCell>
              <TableCell>{r.eventDate}</TableCell>
              <TableCell>{r.clientName}</TableCell>
              <TableCell className="capitalize">{r.eventType}</TableCell>
              <TableCell>{r.guestCount}</TableCell>
              <TableCell>{formatPKR(r.subtotal)}</TableCell>
              <TableCell>{formatPKR(r.discountAmount)}</TableCell>
              <TableCell>{formatPKR(r.taxAmount)}</TableCell>
              <TableCell>{formatPKR(r.grandTotal)}</TableCell>
              <TableCell>{formatPKR(r.amountPaid)}</TableCell>
              <TableCell>{formatPKR(r.balanceDue)}</TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={11} className="text-center text-muted-foreground">
                No bookings in this period.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
