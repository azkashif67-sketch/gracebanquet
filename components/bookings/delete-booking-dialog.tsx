"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field } from "@/components/form-field";
import { deleteBooking } from "@/app/(admin)/bookings/actions";

export function DeleteBookingDialog({
  bookingId,
  invoiceNo,
  redirectTo,
}: {
  bookingId: string;
  invoiceNo: string | null;
  /** Where to go afterwards — the detail page must navigate away. */
  redirectTo?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(undefined);

    const result = await deleteBooking(bookingId, typed);

    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    toast.success("Booking deleted.");
    setOpen(false);
    if (redirectTo) router.push(redirectTo);
    else router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost">Delete</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {invoiceNo}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            This removes the booking from every list, report and calendar. It stays recoverable in
            the database, and the invoice number is never reused. To cancel an event instead — and
            keep it in your revenue figures — use Cancel Booking.
          </p>

          <Field label={`Type ${invoiceNo} to confirm`}>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </Field>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="submit"
              variant="destructive"
              disabled={pending || typed.trim() !== (invoiceNo ?? "")}
            >
              {pending ? "Deleting…" : "Delete booking"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
