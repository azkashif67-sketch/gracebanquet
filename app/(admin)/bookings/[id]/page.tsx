import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/require-role";
import { getBookingDetail } from "@/lib/db/queries/bookings";
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

export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;
  const { created } = await searchParams;

  const detail = await getBookingDetail(id);
  if (!detail) notFound();
  const { booking, serviceLines, menu, extras, taxLines, payments } = detail;

  const showMoney = user.role !== "staff";

  return (
    <div className="flex flex-col gap-4">
      {created === "1" && (
        <div className="rounded-md border border-green-400 bg-green-50 p-3 text-sm dark:bg-green-950">
          Booking {booking.invoiceNo} created successfully.
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{booking.invoiceNo ?? "(draft)"}</h1>
          <Badge className="capitalize">{booking.status}</Badge>
        </div>
        {showMoney && (
          <Button render={<Link href={`/bookings/${id}/invoice`}>Print Invoice</Link>} />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Client</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <p className="font-medium">{booking.clientName}</p>
            <p>{booking.phone}</p>
            {booking.altPhone && <p>Alt: {booking.altPhone}</p>}
            {booking.cnic && <p>CNIC: {booking.cnic}</p>}
            {booking.address && <p>{booking.address}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Event</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <p className="capitalize">{booking.eventType}</p>
            <p>
              {booking.eventDate} · <span className="capitalize">{booking.eventSlot}</span>
            </p>
            <p>{booking.hallSection}</p>
            <p>{booking.guestCount} guests</p>
            {booking.startTime && (
              <p>
                {booking.startTime} – {booking.endTime}
              </p>
            )}
            {booking.specialInstructions && (
              <p className="text-muted-foreground">Note: {booking.specialInstructions}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Services</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Line Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {serviceLines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.serviceName}</TableCell>
                  <TableCell>{l.qty}</TableCell>
                  <TableCell>{formatPKR(l.rate)}</TableCell>
                  <TableCell>{formatPKR(l.lineTotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {menu.length > 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              Menu: {menu.map((m) => m.itemName).join(", ")}
            </p>
          )}
        </CardContent>
      </Card>

      {extras.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Extras</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {extras.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.label}</TableCell>
                    <TableCell>{e.qty}</TableCell>
                    <TableCell>{formatPKR(e.rate)}</TableCell>
                    <TableCell>{formatPKR(e.lineTotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {showMoney && payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Receipt No</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.paidOn}</TableCell>
                    <TableCell>{p.receiptNo}</TableCell>
                    <TableCell className="capitalize">{p.method}</TableCell>
                    <TableCell>{formatPKR(p.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {showMoney && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Charges</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <Row label="Subtotal" value={formatPKR(booking.subtotal)} />
            {booking.discountAmount > 0 && (
              <Row
                label={`Discount${booking.discountReason ? ` (${booking.discountReason})` : ""}`}
                value={`(${formatPKR(booking.discountAmount)})`}
              />
            )}
            <Row label="Taxable Amount" value={formatPKR(booking.taxableAmount)} />
            {taxLines.map((t) => (
              <Row key={t.id} label={`${t.taxName} ${(t.rate / 100).toFixed(2)}%`} value={formatPKR(t.taxAmount)} />
            ))}
            <Row label="Grand Total" value={formatPKR(booking.grandTotal)} bold />
            <Row label="Paid" value={formatPKR(booking.amountPaid)} />
            <Row
              label={booking.balanceDue < 0 ? "Credit" : "Balance Due"}
              value={formatPKR(Math.abs(booking.balanceDue))}
              bold
            />
            {booking.dueDate && <Row label="Due Date" value={booking.dueDate} />}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
