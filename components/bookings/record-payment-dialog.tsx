"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
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
import { toPaisa } from "@/lib/calculations";
import { recordPayment } from "@/app/(admin)/bookings/actions";

const METHODS = ["cash", "bank", "cheque", "easypaisa", "jazzcash"] as const;
const NONE = "__none__";

export interface RecordPaymentDialogProps {
  bookingId: string;
  installments?: { id: string; label: string }[];
}

export function RecordPaymentDialog({ bookingId, installments = [] }: RecordPaymentDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<(typeof METHODS)[number]>("cash");
  const [paidOn, setPaidOn] = useState(format(new Date(), "yyyy-MM-dd"));
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [installmentId, setInstallmentId] = useState(NONE);
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(undefined);

    const result = await recordPayment({
      bookingId,
      amountPaisa: toPaisa(Number(amount)),
      method,
      paidOn,
      reference: reference || undefined,
      notes: notes || undefined,
      installmentId: installmentId === NONE ? undefined : installmentId,
    });

    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.overpaid) {
      toast.warning("Payment recorded — this booking is now overpaid (shows as credit).");
    } else {
      toast.success("Payment recorded.");
    }
    setOpen(false);
    setAmount("");
    setReference("");
    setNotes("");
    setInstallmentId(NONE);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Record Payment</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Amount (Rs)">
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </Field>
          <Field label="Method">
            <Select value={method} onValueChange={(v) => setMethod((v ?? "cash") as typeof method)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => (
                  <SelectItem key={m} value={m} className="capitalize">
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Date">
            <Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} required />
          </Field>
          <Field label="Reference / cheque no">
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
          {installments.length > 0 && (
            <Field label="Apply to installment (optional)">
              <Select value={installmentId} onValueChange={(v) => setInstallmentId(v ?? NONE)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {installments.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      {inst.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Notes">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Record payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
