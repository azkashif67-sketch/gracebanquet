import { formatPKR } from "@/lib/calculations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function LiveSummary({
  clientName,
  eventDate,
  eventSlot,
  guestCount,
  hallRent,
  subtotal,
  discount,
  taxAmount,
  grandTotal,
  advancePaisa,
  /** Already-recorded payments — set when editing an existing booking. */
  alreadyPaidPaisa,
}: {
  clientName: string;
  eventDate: string;
  eventSlot: string;
  guestCount: number;
  hallRent: number;
  subtotal: number;
  discount: number;
  taxAmount: number;
  grandTotal: number;
  advancePaisa: number;
  alreadyPaidPaisa?: number;
}) {
  // While editing, the advance field isn't shown at all — the meaningful
  // figure is what has actually been paid so far, otherwise the panel would
  // claim a balance of the full total on a booking that's part-paid.
  const isEditing = alreadyPaidPaisa !== undefined;
  const paid = isEditing ? alreadyPaidPaisa : advancePaisa;
  const balance = grandTotal - paid;

  return (
    <Card className="w-72 shrink-0 self-start">
      <CardHeader>
        <CardTitle className="text-base">Summary</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 text-sm">
        <Row label="Client" value={clientName || "—"} />
        <Row label="Date" value={eventDate || "—"} />
        <Row label="Slot" value={eventSlot ? eventSlot[0].toUpperCase() + eventSlot.slice(1) : "—"} />
        <Row label="Guests" value={guestCount ? String(guestCount) : "—"} />
        <Separator className="my-2" />
        <Row label="Hall rent" value={formatPKR(hallRent)} />
        <Row label="Services & extras" value={formatPKR(subtotal - hallRent)} />
        <Row label="Subtotal" value={formatPKR(subtotal)} />
        {discount > 0 && <Row label="Discount" value={`(${formatPKR(discount)})`} />}
        <Separator className="my-2" />
        <Row label="Grand Total" value={formatPKR(grandTotal)} bold />
        <Row label={isEditing ? "Paid so far" : "Advance"} value={formatPKR(paid)} />
        <Row label="Balance" value={formatPKR(balance)} bold />
        {taxAmount > 0 && (
          <>
            <Separator className="my-2" />
            <p className="text-xs text-muted-foreground">
              Includes {formatPKR(taxAmount)} sales tax on the hall rent (internal — not shown to
              the client).
            </p>
          </>
        )}
      </CardContent>
    </Card>
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
