import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { getBookingDetail } from "@/lib/db/queries/bookings";
import { getVenueSettings } from "@/lib/db/queries/settings";
import { formatPKR } from "@/lib/calculations";
import { PrintButton } from "@/components/print/print-button";

export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin", "manager");
  const { id } = await params;

  const detail = await getBookingDetail(id);
  if (!detail) notFound();
  const { booking, serviceLines, extras, taxLines, menu, payments } = detail;
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
          <h2 className="font-semibold">INVOICE</h2>
          <p>Invoice #: {booking.invoiceNo}</p>
        </div>
        <div className="text-right">
          <p>Date: {new Date(booking.createdAt * 1000).toLocaleDateString("en-PK")}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <h3 className="font-semibold">BILL TO</h3>
          <p>{booking.clientName}</p>
          <p>{booking.phone}</p>
          {booking.cnic && <p>CNIC: {booking.cnic}</p>}
        </div>
        <div>
          <h3 className="font-semibold">EVENT DETAILS</h3>
          <p className="capitalize">Type: {booking.eventType}</p>
          <p>Date: {booking.eventDate}</p>
          <p className="capitalize">Slot: {booking.eventSlot}</p>
          <p>Hall: {booking.hallSection}</p>
          <p>Guests: {booking.guestCount}</p>
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
          {serviceLines.map((l) => (
            <tr key={l.id}>
              <td className="py-1">{l.serviceName}</td>
              <td className="py-1 text-right">{l.qty}</td>
              <td className="py-1 text-right">{formatPKR(l.rate)}</td>
              <td className="py-1 text-right">{formatPKR(l.lineTotal)}</td>
            </tr>
          ))}
          {extras.length > 0 && (
            <tr>
              <td colSpan={4} className="pt-3 pb-1 font-semibold">
                EXTRAS
              </td>
            </tr>
          )}
          {extras.map((e) => (
            <tr key={e.id}>
              <td className="py-1">{e.label}</td>
              <td className="py-1 text-right">{e.qty}</td>
              <td className="py-1 text-right">{formatPKR(e.rate)}</td>
              <td className="py-1 text-right">{formatPKR(e.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t">
            <td colSpan={3} className="py-1 text-right">
              Subtotal:
            </td>
            <td className="py-1 text-right">{formatPKR(booking.subtotal)}</td>
          </tr>
          {booking.discountAmount > 0 && (
            <tr>
              <td colSpan={3} className="py-1 text-right">
                Discount{booking.discountReason ? ` (${booking.discountReason})` : ""}:
              </td>
              <td className="py-1 text-right">({formatPKR(booking.discountAmount)})</td>
            </tr>
          )}
          <tr>
            <td colSpan={3} className="py-1 text-right">
              Taxable Amount:
            </td>
            <td className="py-1 text-right">{formatPKR(booking.taxableAmount)}</td>
          </tr>
          {taxLines.map((t) => (
            <tr key={t.id}>
              <td colSpan={3} className="py-1 text-right">
                {t.taxName} {(t.rate / 100).toFixed(2)}%:
              </td>
              <td className="py-1 text-right">{formatPKR(t.taxAmount)}</td>
            </tr>
          ))}
          <tr className="border-t font-semibold">
            <td colSpan={3} className="py-1 text-right">
              GRAND TOTAL:
            </td>
            <td className="py-1 text-right">{formatPKR(booking.grandTotal)}</td>
          </tr>
        </tfoot>
      </table>

      {payments.length > 0 && (
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-t">
              <th className="py-1 text-left" colSpan={4}>
                PAYMENTS
              </th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td className="py-1">{p.paidOn}</td>
                <td className="py-1">{p.receiptNo}</td>
                <td className="py-1 capitalize">{p.method}</td>
                <td className="py-1 text-right">({formatPKR(p.amount)})</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="mt-4 flex justify-between border-t pt-2 text-sm font-semibold">
        <span>{booking.balanceDue < 0 ? "CREDIT:" : "BALANCE DUE:"}</span>
        <span>
          {formatPKR(Math.abs(booking.balanceDue))}
          {booking.dueDate ? ` (Due by: ${booking.dueDate})` : ""}
        </span>
      </div>

      {menu.length > 0 && (
        <p className="mt-4 text-sm">
          <span className="font-semibold">MENU:</span> {menu.map((m) => m.itemName).join(", ")}
        </p>
      )}

      {booking.clientNotes && (
        <p className="mt-4 text-sm">
          <span className="font-semibold">Notes:</span> {booking.clientNotes}
        </p>
      )}

      <div className="mt-16 grid grid-cols-2 gap-8 text-sm">
        <div className="border-t pt-1 text-center">Client Signature</div>
        <div className="border-t pt-1 text-center">Authorized Signature</div>
      </div>
    </div>
  );
}
