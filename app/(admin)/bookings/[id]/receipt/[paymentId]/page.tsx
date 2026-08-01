import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { getPaymentReceiptData } from "@/lib/db/queries/bookings";
import { getVenueSettings } from "@/lib/db/queries/settings";
import { amountInWords, formatPKR } from "@/lib/calculations";
import { PrintButton } from "@/components/print/print-button";

export default async function ReceiptPrintPage({
  params,
}: {
  params: Promise<{ id: string; paymentId: string }>;
}) {
  await requireRole("admin", "manager");
  const { id, paymentId } = await params;

  const data = await getPaymentReceiptData(id, paymentId);
  if (!data) notFound();
  const { booking, payment, recordedByName, balanceAfter } = data;
  const venue = await getVenueSettings();
  const isRefund = payment.amount < 0;

  return (
    <div className="mx-auto max-w-md p-8 print:p-0">
      <div className="no-print mb-4 flex justify-end">
        <PrintButton />
      </div>

      <div className="text-center">
        <h1 className="text-lg font-bold">{venue.venueName || "Grace Banquet"}</h1>
        {venue.address && <p className="text-xs">{venue.address}</p>}
        {venue.phone && <p className="text-xs">Ph: {venue.phone}</p>}
      </div>

      <h2 className="mt-4 text-center text-base font-semibold">
        {isRefund ? "REFUND RECEIPT" : "PAYMENT RECEIPT"}
      </h2>

      <div className="mt-4 flex justify-between text-sm">
        <span>Receipt #: {payment.receiptNo}</span>
        <span>Date: {payment.paidOn}</span>
      </div>

      <div className="mt-2 text-sm">
        <p>Client: {booking.clientName}</p>
        <p>Invoice ref: {booking.invoiceNo}</p>
      </div>

      <div className="mt-4 border-t border-b py-3 text-sm">
        <div className="flex justify-between font-semibold">
          <span>Amount {isRefund ? "Refunded" : "Received"}</span>
          <span>{formatPKR(Math.abs(payment.amount))}</span>
        </div>
        <p className="mt-1 text-xs italic text-muted-foreground">
          {amountInWords(Math.abs(payment.amount))}
        </p>
      </div>

      <div className="mt-3 flex flex-col gap-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Method</span>
          <span className="capitalize">{payment.method}</span>
        </div>
        {payment.reference && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Reference</span>
            <span>{payment.reference}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold">
          <span>{balanceAfter < 0 ? "Credit" : "Balance Remaining"}</span>
          <span>{formatPKR(Math.abs(balanceAfter))}</span>
        </div>
      </div>

      <div className="mt-10 flex justify-between text-sm">
        <div className="border-t pt-1 text-center">
          {recordedByName}
          <div className="text-xs text-muted-foreground">Received By</div>
        </div>
        <div className="border-t pt-1 text-center">
          Signature
        </div>
      </div>
    </div>
  );
}
