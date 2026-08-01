import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/require-role";
import { getClientDetail } from "@/lib/db/queries/clients";
import { formatPKR } from "@/lib/calculations";
import { Badge } from "@/components/ui/badge";
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

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ phone: string }>;
}) {
  await requireAuth();
  const { phone: phoneParam } = await params;
  const phone = decodeURIComponent(phoneParam);

  const client = await getClientDetail(phone);
  if (!client) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{client.clientName}</h1>
          <p className="text-sm text-muted-foreground">
            {client.phone}
            {client.altPhone ? ` · Alt: ${client.altPhone}` : ""}
            {client.cnic ? ` · CNIC: ${client.cnic}` : ""}
          </p>
          {client.address && <p className="text-sm text-muted-foreground">{client.address}</p>}
        </div>
        <Button
          render={
            <Link
              href={`/bookings/new?phone=${encodeURIComponent(client.phone)}&name=${encodeURIComponent(client.clientName)}`}
            >
              New booking for this client
            </Link>
          }
        />
      </div>

      {client.isLatePayer && (
        <div className="rounded-md border border-amber-400 bg-amber-50 p-3 text-sm dark:bg-amber-950">
          ⚠ Late-payer: averages {client.averageDaysLate} days late on settled balances.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Total Bookings" value={String(client.bookingCount)} />
        <SummaryCard label="Lifetime Value" value={formatPKR(client.lifetimeValue)} />
        <SummaryCard label="Avg Booking Value" value={formatPKR(client.averageBookingValue)} />
        <SummaryCard label="Outstanding" value={formatPKR(client.totalOutstanding)} />
        <SummaryCard
          label="Avg Days Late"
          value={client.averageDaysLate === null ? "—" : String(client.averageDaysLate)}
        />
        <SummaryCard label="Cancellations" value={String(client.cancellationCount)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Event Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {client.bookings.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <Link href={`/bookings/${b.id}`} className="text-primary hover:underline">
                      {b.invoiceNo ?? "(draft)"}
                    </Link>
                  </TableCell>
                  <TableCell>{b.eventDate}</TableCell>
                  <TableCell className="capitalize">{b.eventType}</TableCell>
                  <TableCell>{formatPKR(b.grandTotal)}</TableCell>
                  <TableCell>{formatPKR(b.balanceDue)}</TableCell>
                  <TableCell>
                    <Badge className="capitalize">{b.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
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
