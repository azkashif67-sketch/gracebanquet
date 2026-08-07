"use client";

import { useMemo, useState } from "react";
import { format, addDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Field } from "@/components/form-field";
import { calculateTotals, formatPKR, toPaisa, toRupees } from "@/lib/calculations";
import { createQuotation } from "@/app/(admin)/quotations/actions";
import type { VenueSettings } from "@/lib/db/queries/settings";
import type { AvailableService, AvailableTax } from "@/components/booking-wizard/types";

interface LineUI {
  kind: "service" | "extra";
  serviceId?: string;
  label: string;
  qty: number;
  ratePaisa: number;
  taxable: boolean;
}

export interface QuotationFormProps {
  services: AvailableService[];
  taxesAvailable: AvailableTax[];
  settings: VenueSettings;
  /** Hall Rent catalogue entry — label and default rate for the pinned line. */
  hallRentService?: { name: string; rate: number } | null;
  sourceInquiryId?: string;
  initial?: {
    clientName?: string;
    phone?: string;
    email?: string;
    eventType?: string;
    eventDatePref?: string;
    eventSlotPref?: "day" | "night";
    guestCount?: number;
  };
}

export function QuotationForm({
  services,
  taxesAvailable,
  settings,
  hallRentService,
  sourceInquiryId,
  initial,
}: QuotationFormProps) {
  const hallRentServiceName = hallRentService?.name ?? "Hall Rent";
  const [clientName, setClientName] = useState(initial?.clientName ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [eventType, setEventType] = useState(initial?.eventType ?? settings.eventTypes[0] ?? "wedding");
  const [eventDatePref, setEventDatePref] = useState(initial?.eventDatePref ?? "");
  const [eventSlotPref, setEventSlotPref] = useState<"day" | "night">(initial?.eventSlotPref ?? "night");
  const [hallPref, setHallPref] = useState(settings.halls[0] ?? "");
  const [guestCount, setGuestCount] = useState(initial?.guestCount ? String(initial.guestCount) : "");
  const [lines, setLines] = useState<LineUI[]>([]);
  const [hallRentRupees, setHallRentRupees] = useState(
    hallRentService ? String(toRupees(hallRentService.rate)) : "",
  );
  const [discountRupees, setDiscountRupees] = useState("0");
  const [selectedTaxIds, setSelectedTaxIds] = useState<string[]>(
    taxesAvailable.filter((t) => t.isDefault === 1).map((t) => t.id),
  );
  const [validUntil, setValidUntil] = useState(
    format(addDays(new Date(), settings.quoteValidityDays), "yyyy-MM-dd"),
  );
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  const categories = useMemo(() => {
    const map = new Map<string, AvailableService[]>();
    for (const s of services) {
      if (lines.some((l) => l.serviceId === s.id)) continue;
      (map.get(s.category) ?? map.set(s.category, []).get(s.category)!).push(s);
    }
    return map;
  }, [services, lines]);

  const hallRentPaisa = toPaisa(Number(hallRentRupees) || 0);

  const totals = useMemo(
    () =>
      calculateTotals({
        hallRent: hallRentPaisa,
        serviceLines: lines
          .filter((l) => l.kind === "service")
          .map((l) => ({ qty: l.qty, rate: l.ratePaisa })),
        extraLines: lines
          .filter((l) => l.kind === "extra")
          .map((l) => ({ qty: l.qty, rate: l.ratePaisa })),
        discountAmount: toPaisa(Number(discountRupees) || 0),
        taxes: taxesAvailable
          .filter((t) => selectedTaxIds.includes(t.id))
          .map((t) => ({ id: t.id, name: t.name, rateBps: t.rate })),
      }),
    [hallRentPaisa, lines, discountRupees, selectedTaxIds, taxesAvailable],
  );

  function addService(serviceId: string) {
    const svc = services.find((s) => s.id === serviceId);
    if (!svc) return;
    const qty = svc.pricingType === "per_head" ? Number(guestCount) || 1 : 1;
    setLines((prev) => [
      ...prev,
      { kind: "service", serviceId: svc.id, label: svc.name, qty, ratePaisa: svc.rate, taxable: svc.taxable === 1 },
    ]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(undefined);

    const result = await createQuotation({
      clientName,
      phone,
      email: email || undefined,
      eventType,
      eventDatePref: eventDatePref || undefined,
      eventSlotPref,
      hallRentPaisa,
      hallPref: hallPref || undefined,
      guestCount: guestCount ? Number(guestCount) : undefined,
      lines: lines.map((l) => ({
        kind: l.kind,
        serviceId: l.serviceId,
        label: l.label,
        qty: l.qty,
        ratePaisa: l.ratePaisa,
        taxable: l.taxable,
      })),
      discountAmountPaisa: toPaisa(Number(discountRupees) || 0),
      taxIds: selectedTaxIds,
      sourceInquiryId,
      validUntil,
      notes: notes || undefined,
    });

    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-6">
      <div className="flex-1 flex flex-col gap-4">
        <h2 className="font-semibold">Client</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Client name">
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} required />
          </Field>
          <Field label="Phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </Field>
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
        </div>

        <h2 className="mt-2 font-semibold">Event preference (non-binding)</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Event type">
            <Select value={eventType} onValueChange={(v) => setEventType(v ?? "")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {settings.eventTypes.map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Guest count">
            <Input type="number" value={guestCount} onChange={(e) => setGuestCount(e.target.value)} />
          </Field>
          <Field label="Preferred date">
            <Input type="date" value={eventDatePref} onChange={(e) => setEventDatePref(e.target.value)} />
          </Field>
          <Field label="Preferred slot">
            <Select value={eventSlotPref} onValueChange={(v) => setEventSlotPref((v ?? "night") as typeof eventSlotPref)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">{settings.slots.day.label}</SelectItem>
                <SelectItem value="night">{settings.slots.night.label}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Preferred hall">
            <Select value={hallPref} onValueChange={(v) => setHallPref(v ?? "")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {settings.halls.map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Valid until">
            <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} required />
          </Field>
        </div>

        <h2 className="mt-2 font-semibold">Services &amp; extras</h2>
        <Select onValueChange={(v) => v && addService(v)} value="">
          <SelectTrigger>
            <SelectValue placeholder="Select a service to add…" />
          </SelectTrigger>
          <SelectContent>
            {[...categories.entries()].map(([category, svcs]) => (
              <div key={category}>
                <div className="px-2 py-1 text-xs font-semibold uppercase text-muted-foreground">{category}</div>
                {svcs.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} — {formatPKR(s.rate)}
                  </SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Total</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Pinned first line, mirroring the booking wizard. Hall rent is
                its own column (quotations.hall_rent) and the sole tax base —
                it must not join `lines` or it would be counted twice. */}
            <TableRow>
              <TableCell className="font-medium">
                {hallRentServiceName}
                <div className="text-xs text-muted-foreground">Charged on every booking</div>
              </TableCell>
              <TableCell>1</TableCell>
              <TableCell>
                <Input
                  type="number"
                  min={0}
                  className="w-28"
                  value={hallRentRupees}
                  onChange={(e) => setHallRentRupees(e.target.value)}
                />
              </TableCell>
              <TableCell>{formatPKR(hallRentPaisa)}</TableCell>
              <TableCell />
            </TableRow>
            {lines.map((l, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Input
                    value={l.label}
                    disabled={l.kind === "service"}
                    onChange={(e) =>
                      setLines((prev) => prev.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))
                    }
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    className="w-20"
                    value={l.qty}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((x, idx) => (idx === i ? { ...x, qty: Number(e.target.value) } : x)),
                      )
                    }
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    className="w-28"
                    value={toRupees(l.ratePaisa)}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((x, idx) =>
                          idx === i ? { ...x, ratePaisa: toPaisa(Number(e.target.value)) } : x,
                        ),
                      )
                    }
                  />
                </TableCell>
                <TableCell>{formatPKR(l.qty * l.ratePaisa)}</TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    Remove
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => setLines((prev) => [...prev, { kind: "extra", label: "", qty: 1, ratePaisa: 0, taxable: true }])}
        >
          Add extra line
        </Button>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Discount (Rs)">
            <Input type="number" value={discountRupees} onChange={(e) => setDiscountRupees(e.target.value)} />
          </Field>
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">
          Hall rent is quoted inclusive of sales tax, and is the only amount tax is charged on.
        </p>

        <div className="flex flex-col gap-2">
          <label className="text-sm text-muted-foreground">Taxes applied (on hall rent)</label>
          {taxesAvailable.map((t) => (
            <label key={t.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selectedTaxIds.includes(t.id)}
                onCheckedChange={(v) =>
                  setSelectedTaxIds((prev) => (v === true ? [...prev, t.id] : prev.filter((id) => id !== t.id)))
                }
              />
              {t.name} {(t.rate / 100).toFixed(2)}%
            </label>
          ))}
        </div>

        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Saving…" : "Create quotation"}
        </Button>
      </div>

      <div className="w-64 shrink-0 self-start rounded-md border p-4 text-sm">
        <p className="mb-2 font-semibold">Summary</p>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Hall rent</span>
          <span>{formatPKR(hallRentPaisa)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Services &amp; extras</span>
          <span>{formatPKR(totals.subtotal - hallRentPaisa)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatPKR(totals.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Discount</span>
          <span>({formatPKR(totals.discount)})</span>
        </div>
        <div className="mt-2 flex justify-between border-t pt-2 font-semibold">
          <span>Grand Total</span>
          <span>{formatPKR(totals.grandTotal)}</span>
        </div>
        {totals.taxAmount > 0 && (
          <div className="mt-2 flex justify-between border-t pt-2 text-xs text-muted-foreground">
            <span>of which sales tax (internal)</span>
            <span>{formatPKR(totals.taxAmount)}</span>
          </div>
        )}
      </div>
    </form>
  );
}
