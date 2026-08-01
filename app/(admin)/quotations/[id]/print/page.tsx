import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/require-role";
import { getQuotationDetail } from "@/lib/db/queries/quotations";
import { getVenueSettings } from "@/lib/db/queries/settings";
import { formatPKR } from "@/lib/calculations";
import { PrintButton } from "@/components/print/print-button";

export default async function QuotationPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuth();
  const { id } = await params;

  const detail = await getQuotationDetail(id);
  if (!detail) notFound();
  const { quotation, lines } = detail;
  const venue = await getVenueSettings();

  return (
    <div className="mx-auto max-w-3xl p-8 print:p-0">
      <div className="no-print mb-4 flex justify-end">
        <PrintButton />
      </div>

      <div className="text-center">
        <h1 className="text-xl font-bold">{venue.venueName || "Grace Banquet"}</h1>
        {venue.address && <p className="text-sm">{venue.address}</p>}
        {venue.phone && <p className="text-sm">Ph: {venue.phone}</p>}
      </div>

      <div className="mt-6 flex justify-between text-sm">
        <div>
          <h2 className="font-semibold">QUOTATION</h2>
          <p>Quote #: {quotation.quoteNo}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold">Valid until: {quotation.validUntil}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <h3 className="font-semibold">FOR</h3>
          <p>{quotation.clientName}</p>
          <p>{quotation.phone}</p>
        </div>
        <div>
          <h3 className="font-semibold">EVENT PREFERENCE</h3>
          {quotation.eventType && <p className="capitalize">Type: {quotation.eventType}</p>}
          <p>Date: {quotation.eventDatePref ?? "TBD"}</p>
          {quotation.hallPref && <p>Hall: {quotation.hallPref}</p>}
          {quotation.guestCount && <p>Guests: {quotation.guestCount}</p>}
        </div>
      </div>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-t">
            <th className="py-1 text-left">Description</th>
            <th className="py-1 text-right">Qty</th>
            <th className="py-1 text-right">Rate</th>
            <th className="py-1 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id}>
              <td className="py-1">{l.label}</td>
              <td className="py-1 text-right">{l.qty}</td>
              <td className="py-1 text-right">{formatPKR(l.rate)}</td>
              <td className="py-1 text-right">{formatPKR(l.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t">
            <td colSpan={3} className="py-1 text-right">Subtotal:</td>
            <td className="py-1 text-right">{formatPKR(quotation.subtotal)}</td>
          </tr>
          {quotation.discountAmount > 0 && (
            <tr>
              <td colSpan={3} className="py-1 text-right">Discount:</td>
              <td className="py-1 text-right">({formatPKR(quotation.discountAmount)})</td>
            </tr>
          )}
          <tr>
            <td colSpan={3} className="py-1 text-right">Tax:</td>
            <td className="py-1 text-right">{formatPKR(quotation.taxAmount)}</td>
          </tr>
          <tr className="border-t font-semibold">
            <td colSpan={3} className="py-1 text-right">GRAND TOTAL:</td>
            <td className="py-1 text-right">{formatPKR(quotation.grandTotal)}</td>
          </tr>
        </tfoot>
      </table>

      {quotation.notes && (
        <p className="mt-4 text-sm">
          <span className="font-semibold">Notes:</span> {quotation.notes}
        </p>
      )}

      <p className="mt-8 text-center text-xs text-muted-foreground">
        This quotation does not reserve a date. Prices and availability are confirmed only upon
        booking.
      </p>
    </div>
  );
}
