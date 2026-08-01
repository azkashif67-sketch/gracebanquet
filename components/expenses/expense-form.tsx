"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/form-field";
import { toPaisa } from "@/lib/calculations";
import { createExpense, updateExpense, type ExpenseInput } from "@/app/(admin)/expenses/actions";

const CATEGORIES = [
  "salaries",
  "utilities",
  "food_raw",
  "decor_material",
  "maintenance",
  "rent",
  "fuel",
  "transport",
  "marketing",
  "equipment",
  "taxes_fees",
  "misc",
] as const;

const NONE = "__none__";

export interface ExpenseFormProps {
  expenseId?: string;
  bookings: { id: string; invoiceNo: string | null; clientName: string }[];
  initial?: {
    expenseDate: string;
    category: (typeof CATEGORIES)[number];
    description: string;
    amountRupees: number;
    vendor?: string;
    method?: string;
    reference?: string;
    bookingId?: string;
    isRecurring: boolean;
  };
}

export function ExpenseForm({ expenseId, bookings, initial }: ExpenseFormProps) {
  const [expenseDate, setExpenseDate] = useState(
    initial?.expenseDate ?? new Date().toISOString().slice(0, 10),
  );
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>(initial?.category ?? "misc");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amountRupees) : "");
  const [vendor, setVendor] = useState(initial?.vendor ?? "");
  const [method, setMethod] = useState(initial?.method ?? "");
  const [reference, setReference] = useState(initial?.reference ?? "");
  const [bookingId, setBookingId] = useState(initial?.bookingId ?? NONE);
  const [isRecurring, setIsRecurring] = useState(initial?.isRecurring ?? false);
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(undefined);

    const input: ExpenseInput = {
      expenseDate,
      category,
      description,
      amountPaisa: toPaisa(Number(amount)),
      vendor: vendor || undefined,
      method: method || undefined,
      reference: reference || undefined,
      bookingId: bookingId === NONE ? undefined : bookingId,
      isRecurring,
    };

    const result = expenseId ? await updateExpense(expenseId, input) : await createExpense(input);
    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Date">
          <Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} required />
        </Field>
        <Field label="Category">
          <Select value={category} onValueChange={(v) => setCategory((v ?? "misc") as typeof category)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c} className="capitalize">
                  {c.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Description">
        <Input value={description} onChange={(e) => setDescription(e.target.value)} required />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Amount (Rs)">
          <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </Field>
        <Field label="Vendor / Paid To">
          <Input value={vendor} onChange={(e) => setVendor(e.target.value)} />
        </Field>
        <Field label="Payment method">
          <Input value={method} onChange={(e) => setMethod(e.target.value)} />
        </Field>
        <Field label="Reference / Bill No">
          <Input value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
      </div>

      <Field label="Link to booking (optional)">
        <Select value={bookingId} onValueChange={(v) => setBookingId(v ?? NONE)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>None — general overhead</SelectItem>
            {bookings.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.invoiceNo ?? "(draft)"} — {b.clientName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <p className="text-xs text-muted-foreground">
        Link event-specific costs (raw food, extra decor, hired staff) to their booking — that&apos;s what
        makes profit-per-event possible. Leave blank for overhead like rent or salaries.
      </p>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={isRecurring} onCheckedChange={(v) => setIsRecurring(v === true)} />
        Recurring monthly
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Save expense"}
      </Button>
    </form>
  );
}
