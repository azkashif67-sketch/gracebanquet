import { formatPKR } from "@/lib/calculations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function LiveSummary({
  clientName,
  eventDate,
  eventSlot,
  guestCount,
  subtotal,
  discount,
  taxAmount,
  grandTotal,
  advancePaisa,
}: {
  clientName: string;
  eventDate: string;
  eventSlot: string;
  guestCount: number;
  subtotal: number;
  discount: number;
  taxAmount: number;
  grandTotal: number;
  advancePaisa: number;
}) {
  const balance = grandTotal - advancePaisa;

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
        <Row label="Subtotal" value={formatPKR(subtotal)} />
        {discount > 0 && <Row label="Discount" value={`(${formatPKR(discount)})`} />}
        <Row label="Tax" value={formatPKR(taxAmount)} />
        <Separator className="my-2" />
        <Row label="Grand Total" value={formatPKR(grandTotal)} bold />
        <Row label="Advance" value={formatPKR(advancePaisa)} />
        <Row label="Balance" value={formatPKR(balance)} bold />
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
