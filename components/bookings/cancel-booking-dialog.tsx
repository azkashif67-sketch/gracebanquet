"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/form-field";
import { formatPKR, toPaisa } from "@/lib/calculations";
import { cancelBooking } from "@/app/(admin)/bookings/actions";

const REASONS = [
  "Client Cancelled",
  "Date Changed",
  "Payment Not Received",
  "Venue Issue",
  "Other",
] as const;

type Handling = "forfeit" | "refund_partial" | "refund_full";

export function CancelBookingDialog({
  bookingId,
  invoiceNo,
  amountPaid,
}: {
  bookingId: string;
  invoiceNo: string | null;
  amountPaid: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [reasonNote, setReasonNote] = useState("");
  const [handling, setHandling] = useState<Handling>("forfeit");
  const [refundRupees, setRefundRupees] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(undefined);

    const result = await cancelBooking({
      bookingId,
      reason: reasonNote.trim() ? `${reason} — ${reasonNote.trim()}` : reason,
      advanceHandling: handling,
      refundAmountPaisa:
        handling === "refund_partial" ? toPaisa(Number(refundRupees) || 0) : undefined,
    });

    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    toast.success("Booking cancelled. The slot is now free.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">Cancel Booking</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel {invoiceNo}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            The date and slot are released immediately. This is recorded as a cancellation, not a
            deletion — the booking stays in your records and reports.
          </p>

          <Field label="Reason">
            <Select value={reason} onValueChange={(v) => setReason(v ?? REASONS[0])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Notes (optional)">
            <Textarea value={reasonNote} onChange={(e) => setReasonNote(e.target.value)} />
          </Field>

          <Field label={`Advance handling — ${formatPKR(amountPaid)} received`}>
            <Select value={handling} onValueChange={(v) => setHandling((v ?? "forfeit") as Handling)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="forfeit">Forfeit — keep the advance as revenue</SelectItem>
                <SelectItem value="refund_partial">Refund part of it</SelectItem>
                <SelectItem value="refund_full">Refund all of it</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {handling === "refund_partial" && (
            <Field label="Refund amount (Rs)">
              <Input
                type="number"
                min={0}
                value={refundRupees}
                onChange={(e) => setRefundRupees(e.target.value)}
              />
            </Field>
          )}

          {handling === "forfeit" && amountPaid > 0 && (
            <p className="text-sm text-muted-foreground">
              {formatPKR(amountPaid)} stays recorded as revenue.
            </p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Cancelling…" : "Cancel booking"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
