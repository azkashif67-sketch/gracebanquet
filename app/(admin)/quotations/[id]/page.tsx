import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { getQuotationDetail } from "@/lib/db/queries/quotations";
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
import { QuotationStatusButtons, DeleteQuotationButton } from "@/components/quotations/quotation-actions";

export default async function QuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("admin");
  const canManage = user.role === "admin" || user.role === "manager";
  const { id } = await params;

  const detail = await getQuotationDetail(id);
  if (!detail) notFound();
  const { quotation, lines, displayStatus } = detail;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{quotation.quoteNo}</h1>
          <Badge className="capitalize">{displayStatus}</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" render={<Link href={`/quotations/${id}/print`}>Print</Link>} />
          {canManage && displayStatus !== "converted" && displayStatus !== "expired" && (
            <Button
              render={
                <Link href={`/bookings/new?fromQuotationId=${id}`}>Convert to Booking</Link>
              }
            />
          )}
        </div>
      </div>

      {quotation.status === "converted" && quotation.convertedBookingId && (
        <div className="rounded-md border border-green-400 bg-green-50 p-3 text-sm dark:bg-green-950">
          Converted to{" "}
          <Link href={`/bookings/${quotation.convertedBookingId}`} className="text-primary hover:underline">
            booking
          </Link>
          .
        </div>
      )}

      {canManage && quotation.status !== "converted" && (
        <div className="flex items-center justify-between">
          <QuotationStatusButtons id={id} status={quotation.status} />
          <DeleteQuotationButton id={id} quoteNo={quotation.quoteNo} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Client</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <p className="font-medium">{quotation.clientName}</p>
            <p>{quotation.phone}</p>
            {quotation.email && <p>{quotation.email}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Event Preference</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            {quotation.eventType && <p className="capitalize">{quotation.eventType}</p>}
            <p>
              {quotation.eventDatePref ?? "No date preference"}
              {quotation.eventSlotPref ? ` · ${quotation.eventSlotPref}` : ""}
            </p>
            {quotation.hallPref && <p>{quotation.hallPref}</p>}
            {quotation.guestCount && <p>{quotation.guestCount} guests</p>}
            <p className="text-xs text-muted-foreground">Valid until {quotation.validUntil}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line Items</CardTitle>
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
              {lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.label}</TableCell>
                  <TableCell>{l.qty}</TableCell>
                  <TableCell>{formatPKR(l.rate)}</TableCell>
                  <TableCell>{formatPKR(l.lineTotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-4 flex flex-col gap-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatPKR(quotation.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discount</span>
              <span>({formatPKR(quotation.discountAmount)})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span>{formatPKR(quotation.taxAmount)}</span>
            </div>
            <div className="flex justify-between border-t pt-1 font-semibold">
              <span>Grand Total</span>
              <span>{formatPKR(quotation.grandTotal)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {quotation.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{quotation.notes}</CardContent>
        </Card>
      )}
    </div>
  );
}
