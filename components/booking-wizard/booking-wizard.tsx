"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { calculateTotals, toPaisa, toRupees, formatPKR } from "@/lib/calculations";
import type { AvailabilityResult } from "@/lib/db/operations";
import {
  checkAvailabilityAction,
  createBooking,
  updateBooking,
  lookupClientByPhone,
  type BookingInput,
} from "@/app/(admin)/bookings/actions";
import type { VenueSettings } from "@/lib/db/queries/settings";
import { LiveSummary } from "./live-summary";
import { Field } from "@/components/form-field";
import type {
  AvailableService,
  AvailableTax,
  ExtraLineUI,
  InstallmentRowUI,
  MenuLineUI,
  ServiceLineUI,
} from "./types";

const STEP_TITLES = ["Client & Event", "Services", "Extras & Charges", "Payment & Notes"];

export interface BookingWizardProps {
  services: AvailableService[];
  cateringMenus: Record<string, { name: string; type: string }[]>;
  taxesAvailable: AvailableTax[];
  settings: VenueSettings;
  canApplyDiscount: boolean;
  canOverride: boolean;
  prefill?: {
    eventDate?: string;
    eventSlot?: "day" | "night";
    hallSection?: string;
    phone?: string;
    clientName?: string;
    eventType?: string;
    guestCount?: number;
  };
  /** Set when arriving via "Convert to Booking" from a quotation. */
  fromQuotation?: {
    id: string;
    lines: ServiceLineUI[];
    extras: ExtraLineUI[];
    hallRentPaisa: number;
    discountAmountPaisa: number;
    taxIds: string[];
  };
  /** Set when arriving via "Convert to Booking" from an inquiry. */
  sourceInquiryId?: string;
  /** Set when editing an existing booking rather than creating one. */
  editing?: {
    bookingId: string;
    invoiceNo: string | null;
    amountPaidPaisa: number;
    clientName: string;
    phone: string;
    altPhone: string;
    cnic: string;
    address: string;
    eventType: string;
    eventDate: string;
    eventSlot: "day" | "night";
    hallSection: string;
    guestCount: number;
    startTime: string;
    endTime: string;
    status: "confirmed" | "tentative";
    holdExpiresOn: string;
    hallRentPaisa: number;
    discountAmountPaisa: number;
    discountReason: string;
    taxIds: string[];
    lines: ServiceLineUI[];
    extras: ExtraLineUI[];
    menu: { itemName: string; type: string }[];
    dueDate: string;
    internalNotes: string;
    clientNotes: string;
    specialInstructions: string;
  };
}

export function BookingWizard({
  services,
  cateringMenus,
  taxesAvailable,
  settings,
  canApplyDiscount,
  canOverride,
  prefill,
  fromQuotation,
  sourceInquiryId,
  editing,
}: BookingWizardProps) {
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  // Step 1 — client
  const [phone, setPhone] = useState(editing?.phone ?? prefill?.phone ?? "");
  const [clientName, setClientName] = useState(editing?.clientName ?? prefill?.clientName ?? "");
  const [altPhone, setAltPhone] = useState(editing?.altPhone ?? "");
  const [cnic, setCnic] = useState(editing?.cnic ?? "");
  const [address, setAddress] = useState(editing?.address ?? "");
  const [clientMatch, setClientMatch] = useState<{
    clientName: string;
    cnic: string | null;
    address: string | null;
    altPhone: string | null;
    previousCount: number;
  } | null>(null);

  // Step 1 — event
  const [eventType, setEventType] = useState(
    editing?.eventType ?? prefill?.eventType ?? settings.eventTypes[0] ?? "wedding",
  );
  const [eventDate, setEventDate] = useState(editing?.eventDate ?? prefill?.eventDate ?? "");
  const [eventSlot, setEventSlot] = useState<"day" | "night">(
    editing?.eventSlot ?? prefill?.eventSlot ?? "night",
  );
  const [hallSection, setHallSection] = useState(
    editing?.hallSection ?? prefill?.hallSection ?? settings.halls[0] ?? "",
  );
  const [guestCount, setGuestCount] = useState(
    editing ? String(editing.guestCount) : prefill?.guestCount ? String(prefill.guestCount) : "",
  );
  const [startTime, setStartTime] = useState(editing?.startTime ?? "");
  const [endTime, setEndTime] = useState(editing?.endTime ?? "");
  const [status, setStatus] = useState<"confirmed" | "tentative">(editing?.status ?? "confirmed");
  const [holdExpiresOn, setHoldExpiresOn] = useState(
    editing?.holdExpiresOn || format(addDays(new Date(), settings.holdDefaultDays), "yyyy-MM-dd"),
  );
  const [availability, setAvailability] = useState<AvailabilityResult | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  // Step 2 — services / menu
  const [lines, setLines] = useState<ServiceLineUI[]>(editing?.lines ?? fromQuotation?.lines ?? []);
  const [menus, setMenus] = useState<Record<string, MenuLineUI[]>>(() => {
    const source = editing ?? fromQuotation;
    if (!source) return {};
    const initial: Record<string, MenuLineUI[]> = {};
    // When editing, the saved menu is the source of truth: tick exactly what
    // was agreed, not the service's full default dish list.
    const savedNames = editing ? new Set(editing.menu.map((m) => m.itemName)) : null;
    for (const line of source.lines) {
      if (line.category === "catering" && cateringMenus[line.serviceId]) {
        const defaults = cateringMenus[line.serviceId].map((m) => ({
          itemName: m.name,
          type: m.type,
          checked: savedNames ? savedNames.has(m.name) : true,
        }));
        // Custom dishes typed on the original booking aren't in the catalogue.
        const extraSaved = editing
          ? editing.menu
              .filter((m) => !cateringMenus[line.serviceId].some((d) => d.name === m.itemName))
              .map((m) => ({ itemName: m.itemName, type: m.type, checked: true }))
          : [];
        initial[line.serviceId] = [...defaults, ...extraSaved];
      }
    }
    return initial;
  });

  // Step 3 — extras & charges
  const [hallRentRupees, setHallRentRupees] = useState(() => {
    const source = editing ?? fromQuotation;
    return source ? String(toRupees(source.hallRentPaisa)) : "";
  });
  const [extras, setExtras] = useState<ExtraLineUI[]>(
    editing?.extras ?? fromQuotation?.extras ?? [],
  );
  const [discountRupees, setDiscountRupees] = useState(() => {
    const source = editing ?? fromQuotation;
    return source ? String(toRupees(source.discountAmountPaisa)) : "0";
  });
  const [discountReason, setDiscountReason] = useState(editing?.discountReason ?? "");
  const [selectedTaxIds, setSelectedTaxIds] = useState<string[]>(
    editing?.taxIds ??
      fromQuotation?.taxIds ??
      taxesAvailable.filter((t) => t.isDefault === 1).map((t) => t.id),
  );

  // Step 4 — payment & notes
  const [advanceRupees, setAdvanceRupees] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "bank" | "cheque" | "easypaisa" | "jazzcash"
  >("cash");
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [paymentReference, setPaymentReference] = useState("");
  const [dueDate, setDueDate] = useState(editing?.dueDate ?? "");
  const [usePaymentPlan, setUsePaymentPlan] = useState(false);
  const [installmentRows, setInstallmentRows] = useState<InstallmentRowUI[]>([]);
  const [splitCount, setSplitCount] = useState("3");
  const [internalNotes, setInternalNotes] = useState(editing?.internalNotes ?? "");
  const [clientNotes, setClientNotes] = useState(editing?.clientNotes ?? "");
  const [specialInstructions, setSpecialInstructions] = useState(
    editing?.specialInstructions ?? "",
  );

  // Auto-fill due date from event date + offset, once, when the user first
  // reaches step 4 without having set one.
  useEffect(() => {
    if (step === 3 && !dueDate && eventDate) {
      setDueDate(format(addDays(new Date(eventDate), -settings.dueDateOffsetDays), "yyyy-MM-dd"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Live phone lookup, debounced.
  useEffect(() => {
    if (phone.trim().length < 3) {
      setClientMatch(null);
      return;
    }
    const handle = setTimeout(async () => {
      const match = await lookupClientByPhone(phone.trim());
      setClientMatch(match);
    }, 300);
    return () => clearTimeout(handle);
  }, [phone]);

  // Live availability check, debounced.
  useEffect(() => {
    if (!eventDate || !hallSection) {
      setAvailability(null);
      return;
    }
    setCheckingAvailability(true);
    const handle = setTimeout(async () => {
      const result = await checkAvailabilityAction({
        eventDate,
        eventSlot,
        hallSection,
        // When editing, a booking must not be reported as conflicting with itself.
        excludeBookingId: editing?.bookingId,
      });
      setAvailability(result);
      setCheckingAvailability(false);
    }, 300);
    return () => {
      clearTimeout(handle);
      setCheckingAvailability(false);
    };
  }, [eventDate, eventSlot, hallSection, editing?.bookingId]);

  function applyAutofill() {
    if (!clientMatch) return;
    setClientName(clientMatch.clientName);
    setCnic(clientMatch.cnic ?? "");
    setAddress(clientMatch.address ?? "");
    setAltPhone(clientMatch.altPhone ?? "");
  }

  function addService(serviceId: string) {
    const svc = services.find((s) => s.id === serviceId);
    if (!svc || lines.some((l) => l.serviceId === serviceId)) return;
    const qty = svc.pricingType === "per_head" ? Number(guestCount) || 1 : 1;
    setLines((prev) => [
      ...prev,
      {
        serviceId: svc.id,
        serviceName: svc.name,
        category: svc.category,
        pricingType: svc.pricingType,
        qty,
        ratePaisa: svc.rate,
        taxable: svc.taxable === 1,
      },
    ]);
    if (svc.category === "catering" && cateringMenus[svc.id]) {
      setMenus((prev) => ({
        ...prev,
        [svc.id]: cateringMenus[svc.id].map((m) => ({
          itemName: m.name,
          type: m.type,
          checked: true,
        })),
      }));
    }
  }

  function removeService(serviceId: string) {
    setLines((prev) => prev.filter((l) => l.serviceId !== serviceId));
    setMenus((prev) => {
      const next = { ...prev };
      delete next[serviceId];
      return next;
    });
  }

  function updateLine(serviceId: string, patch: Partial<ServiceLineUI>) {
    setLines((prev) => prev.map((l) => (l.serviceId === serviceId ? { ...l, ...patch } : l)));
  }

  const hallRentPaisa = toPaisa(Number(hallRentRupees) || 0);

  const totals = useMemo(
    () =>
      calculateTotals({
        hallRent: hallRentPaisa,
        serviceLines: lines.map((l) => ({ qty: l.qty, rate: l.ratePaisa })),
        extraLines: extras.map((e) => ({ qty: e.qty, rate: e.ratePaisa })),
        discountAmount: toPaisa(Number(discountRupees) || 0),
        taxes: taxesAvailable
          .filter((t) => selectedTaxIds.includes(t.id))
          .map((t) => ({ id: t.id, name: t.name, rateBps: t.rate })),
      }),
    [hallRentPaisa, lines, extras, discountRupees, selectedTaxIds, taxesAvailable],
  );

  const advancePaisa = toPaisa(Number(advanceRupees) || 0);
  const balance = totals.grandTotal - advancePaisa;

  const installmentSumPaisa = installmentRows.reduce(
    (s, r) => s + toPaisa(Number(r.amountRupees) || 0),
    0,
  );
  const installmentRemainder = totals.grandTotal - installmentSumPaisa;

  function splitEvenly() {
    const n = Math.max(1, Math.min(12, Math.floor(Number(splitCount)) || 1));
    const base = Math.floor(totals.grandTotal / n);
    const remainder = totals.grandTotal - base * n;
    const rows: InstallmentRowUI[] = Array.from({ length: n }, (_, i) => {
      const amountPaisa = base + (i === n - 1 ? remainder : 0);
      const due =
        i === 0
          ? format(new Date(), "yyyy-MM-dd")
          : format(addDays(new Date(), i * 30), "yyyy-MM-dd");
      return {
        label: i === 0 ? "Advance" : i === n - 1 ? "Balance on event day" : `Installment ${i + 1}`,
        amountRupees: String(toRupees(amountPaisa)),
        dueDate: due,
      };
    });
    setInstallmentRows(rows);
  }

  function validateStep(): string | undefined {
    if (step === 0) {
      if (!phone.trim()) return "Phone is required.";
      if (!clientName.trim()) return "Client name is required.";
      if (!eventDate) return "Event date is required.";
      if (!hallSection) return "Hall/section is required.";
      if (!guestCount || Number(guestCount) <= 0) return "Guest count is required.";
      if (availability && !availability.available && !(canOverride && overrideReason.trim())) {
        return "This date/slot/hall is already booked. An admin override reason is required to continue.";
      }
    }
    if (step === 2) {
      if (hallRentRupees.trim() === "" || Number(hallRentRupees) < 0) {
        return "Hall rent is required (enter 0 if the hall is not being charged).";
      }
      if (Number(discountRupees) > 0 && !discountReason.trim()) {
        return "Discount reason is required when a discount is applied.";
      }
    }
    if (step === 3) {
      if (advancePaisa > 0 && !paymentMethod) return "Payment method is required.";
      if (usePaymentPlan) {
        if (installmentRows.length === 0) return "Add at least one installment step.";
        if (installmentRows.some((r) => !r.label.trim() || !r.dueDate || Number(r.amountRupees) <= 0)) {
          return "Every installment needs a label, a positive amount, and a due date.";
        }
        if (installmentRemainder !== 0) {
          return `Installment plan must total the grand total — ${installmentRemainder > 0 ? "short by" : "over by"} ${formatPKR(Math.abs(installmentRemainder))}.`;
        }
      } else if (balance > 0 && !dueDate) {
        return "Due date is required when a balance remains.";
      }
    }
    return undefined;
  }

  function next() {
    const err = validateStep();
    if (err) {
      setStepError(err);
      return;
    }
    setStepError(undefined);
    setStep((s) => Math.min(s + 1, STEP_TITLES.length - 1));
  }

  function back() {
    setStepError(undefined);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function submit() {
    const err = validateStep();
    if (err) {
      setStepError(err);
      return;
    }
    setSubmitting(true);
    setSubmitError(undefined);

    const input: BookingInput = {
      sourceQuotationId: fromQuotation?.id,
      sourceInquiryId,
      clientName,
      phone,
      altPhone: altPhone || undefined,
      cnic: cnic || undefined,
      address: address || undefined,
      eventType,
      eventDate,
      eventSlot,
      hallSection,
      guestCount: Number(guestCount),
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      status,
      holdExpiresOn: status === "tentative" ? holdExpiresOn : undefined,
      overrideReason: overrideReason || undefined,
      services: lines.map((l) => ({
        serviceId: l.serviceId,
        serviceName: l.serviceName,
        pricingType: l.pricingType,
        qty: l.qty,
        ratePaisa: l.ratePaisa,
        taxable: l.taxable,
      })),
      menu: Object.values(menus)
        .flat()
        .filter((m) => m.checked)
        .map((m) => ({ itemName: m.itemName, type: m.type })),
      extras: extras.map((e) => ({
        label: e.label,
        qty: e.qty,
        ratePaisa: e.ratePaisa,
        taxable: e.taxable,
      })),
      hallRentPaisa,
      discountAmountPaisa: toPaisa(Number(discountRupees) || 0),
      discountReason: discountReason || undefined,
      taxIds: selectedTaxIds,
      advanceAmountPaisa: advancePaisa,
      paymentMethod: advancePaisa > 0 ? paymentMethod : undefined,
      paymentDate: advancePaisa > 0 ? paymentDate : undefined,
      paymentReference: paymentReference || undefined,
      dueDate: usePaymentPlan ? undefined : dueDate || undefined,
      installments: usePaymentPlan
        ? installmentRows.map((r) => ({
            label: r.label,
            amountPaisa: toPaisa(Number(r.amountRupees) || 0),
            dueDate: r.dueDate,
          }))
        : undefined,
      internalNotes: internalNotes || undefined,
      clientNotes: clientNotes || undefined,
      specialInstructions: specialInstructions || undefined,
    };

    const result = editing
      ? await updateBooking(editing.bookingId, input)
      : await createBooking(input);
    if (result?.error) {
      setSubmitError(result.error);
      setSubmitting(false);
    }
    // On success both actions redirect, which throws NEXT_REDIRECT and never
    // returns here.
  }

  const categories = useMemo(() => {
    const map = new Map<string, AvailableService[]>();
    for (const s of services) {
      if (lines.some((l) => l.serviceId === s.id)) continue;
      (map.get(s.category) ?? map.set(s.category, []).get(s.category)!).push(s);
    }
    return map;
  }, [services, lines]);

  return (
    <div className="flex gap-6">
      <div className="flex-1">
        <div className="mb-4 flex gap-2 text-sm">
          {STEP_TITLES.map((title, i) => (
            <div
              key={title}
              className={`rounded-full px-3 py-1 ${
                i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}. {title}
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="flex flex-col gap-4">
            <h2 className="font-semibold">Client</h2>
            <Field label="Phone">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            {clientMatch && (
              <div className="flex items-center justify-between rounded-md border border-yellow-400 bg-yellow-50 p-2 text-sm dark:bg-yellow-950">
                <span>
                  Existing client: {clientMatch.clientName} — {clientMatch.previousCount} previous
                  booking{clientMatch.previousCount === 1 ? "" : "s"}.
                </span>
                <Button type="button" size="sm" variant="outline" onClick={applyAutofill}>
                  Autofill
                </Button>
              </div>
            )}
            <Field label="Client name">
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
            </Field>
            <Field label="Alternate phone">
              <Input value={altPhone} onChange={(e) => setAltPhone(e.target.value)} />
            </Field>
            <Field label="CNIC">
              <Input value={cnic} onChange={(e) => setCnic(e.target.value)} />
            </Field>
            <Field label="Address">
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </Field>

            <h2 className="mt-2 font-semibold">Event</h2>
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
                <Input
                  type="number"
                  min={1}
                  value={guestCount}
                  onChange={(e) => setGuestCount(e.target.value)}
                />
              </Field>
              <Field label="Event date">
                <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
              </Field>
              <Field label="Slot">
                <Select value={eventSlot} onValueChange={(v) => setEventSlot(v as "day" | "night")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">{settings.slots.day.label}</SelectItem>
                    <SelectItem value="night">{settings.slots.night.label}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {/* With a single hall there is nothing to choose — it's already
                  selected by default, so showing a one-option dropdown is noise. */}
              {settings.halls.length > 1 && (
                <Field label="Hall / section">
                  <Select value={hallSection} onValueChange={(v) => setHallSection(v ?? "")}>
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
              )}
              <Field label="Status">
                <Select value={status} onValueChange={(v) => setStatus(v as "confirmed" | "tentative")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="tentative">Tentative</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {status === "tentative" && (
                <Field label="Hold expires on">
                  <Input
                    type="date"
                    value={holdExpiresOn}
                    onChange={(e) => setHoldExpiresOn(e.target.value)}
                  />
                </Field>
              )}
              <Field label="Start time">
                <Input value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </Field>
              <Field label="End time">
                <Input value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </Field>
            </div>

            <div className="text-sm">
              {checkingAvailability && <p className="text-muted-foreground">Checking availability…</p>}
              {!checkingAvailability && availability?.available && (
                <p className="text-green-600">
                  ✓ Available — {hallSection}, {eventSlot}, {eventDate}
                </p>
              )}
              {!checkingAvailability && availability && !availability.available && (
                <div className="flex flex-col gap-2 text-destructive">
                  <p>
                    ✗ Occupied —{" "}
                    {availability.conflicts
                      .map((c) => `${c.invoiceNo ?? "(no invoice)"} · ${c.clientName} · ${c.status}`)
                      .join(", ")}
                  </p>
                  {canOverride && (
                    <Field label="Override reason (required to continue)">
                      <Input
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                      />
                    </Field>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <h2 className="font-semibold">Add services</h2>
            <Select onValueChange={(v) => v && addService(v)} value="">

              <SelectTrigger>
                <SelectValue placeholder="Select a service to add…" />
              </SelectTrigger>
              <SelectContent>
                {[...categories.entries()].map(([category, svcs]) => (
                  <div key={category}>
                    <div className="px-2 py-1 text-xs font-semibold uppercase text-muted-foreground">
                      {category}
                    </div>
                    {svcs.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} — {formatPKR(s.rate)} ({s.pricingType.replace("_", " ")})
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Line Total</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l) => (
                  <TableRow key={l.serviceId}>
                    <TableCell>{l.serviceName}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className="w-20"
                        value={l.qty}
                        onChange={(e) => updateLine(l.serviceId, { qty: Number(e.target.value) })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className="w-28"
                        value={toRupees(l.ratePaisa)}
                        onChange={(e) =>
                          updateLine(l.serviceId, { ratePaisa: toPaisa(Number(e.target.value)) })
                        }
                      />
                    </TableCell>
                    <TableCell>{formatPKR(l.qty * l.ratePaisa)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => removeService(l.serviceId)}>
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {lines.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No services added yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {lines
              .filter((l) => l.category === "catering" && menus[l.serviceId])
              .map((l) => (
                <div key={l.serviceId} className="rounded-md border p-3">
                  <p className="mb-2 font-medium">Menu — {l.serviceName}</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {menus[l.serviceId].map((item, i) => (
                      <label key={i} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={item.checked}
                          onCheckedChange={(v) =>
                            setMenus((prev) => ({
                              ...prev,
                              [l.serviceId]: prev[l.serviceId].map((m, idx) =>
                                idx === i ? { ...m, checked: v === true } : m,
                              ),
                            }))
                          }
                        />
                        {item.itemName}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <h2 className="font-semibold">Hall Rent</h2>
            <div className="flex flex-col gap-2 rounded-md border p-3">
              <Field label="Hall rent (Rs)">
                <Input
                  type="number"
                  min={0}
                  className="w-40"
                  value={hallRentRupees}
                  onChange={(e) => setHallRentRupees(e.target.value)}
                />
              </Field>
              <p className="text-xs text-muted-foreground">
                Quoted inclusive of sales tax. This is the only amount tax is charged on —
                catering, decor and other services are not taxed.
              </p>
              {totals.taxAmount > 0 && (
                <div className="rounded-md bg-muted/50 p-2 text-sm">
                  <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                    Internal — not shown to the client
                  </p>
                  {totals.taxLines.map((t) => (
                    <div key={t.id} className="flex justify-between">
                      <span className="text-muted-foreground">
                        {t.name} {(t.rateBps / 100).toFixed(2)}% (included)
                      </span>
                      <span>{formatPKR(t.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-medium">
                    <span>Rent net of tax</span>
                    <span>{formatPKR(hallRentPaisa - totals.taxAmount)}</span>
                  </div>
                </div>
              )}
            </div>

            <h2 className="font-semibold">Extras</h2>
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
                {extras.map((e, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Input
                        placeholder="Description"
                        value={e.label}
                        onChange={(ev) =>
                          setExtras((prev) =>
                            prev.map((x, idx) => (idx === i ? { ...x, label: ev.target.value } : x)),
                          )
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className="w-20"
                        value={e.qty}
                        onChange={(ev) =>
                          setExtras((prev) =>
                            prev.map((x, idx) =>
                              idx === i ? { ...x, qty: Number(ev.target.value) } : x,
                            ),
                          )
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className="w-28"
                        value={toRupees(e.ratePaisa)}
                        onChange={(ev) =>
                          setExtras((prev) =>
                            prev.map((x, idx) =>
                              idx === i ? { ...x, ratePaisa: toPaisa(Number(ev.target.value)) } : x,
                            ),
                          )
                        }
                      />
                    </TableCell>
                    <TableCell>{formatPKR(e.qty * e.ratePaisa)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExtras((prev) => prev.filter((_, idx) => idx !== i))}
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
              onClick={() =>
                setExtras((prev) => [...prev, { label: "", qty: 1, ratePaisa: 0, taxable: true }])
              }
            >
              Add extra
            </Button>

            <h2 className="mt-2 font-semibold">Charges</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Discount (Rs)">
                <Input
                  type="number"
                  min={0}
                  value={discountRupees}
                  onChange={(e) => setDiscountRupees(e.target.value)}
                  disabled={!canApplyDiscount}
                />
              </Field>
              <Field label="Discount reason">
                <Input
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  disabled={!canApplyDiscount}
                />
              </Field>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Taxes applied (on hall rent)</Label>
              {taxesAvailable.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selectedTaxIds.includes(t.id)}
                    onCheckedChange={(v) =>
                      setSelectedTaxIds((prev) =>
                        v === true ? [...prev, t.id] : prev.filter((id) => id !== t.id),
                      )
                    }
                  />
                  {t.name} {(t.rate / 100).toFixed(2)}%
                </label>
              ))}
            </div>

            <div className="flex flex-col gap-1 rounded-md border p-3 text-sm">
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
              {totals.discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span>({formatPKR(totals.discount)})</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-1 font-semibold">
                <span>Grand total (client pays)</span>
                <span>{formatPKR(totals.grandTotal)}</span>
              </div>
              {totals.taxAmount > 0 && (
                <div className="mt-1 flex justify-between border-t pt-1 text-xs text-muted-foreground">
                  <span>of which sales tax (included, internal)</span>
                  <span>{formatPKR(totals.taxAmount)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <h2 className="font-semibold">Payment</h2>
            {editing && (
              <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                Payments already recorded are not changed by an edit. To take another payment or
                issue a refund, use Record Payment on the booking page.
              </p>
            )}
            <div className="grid grid-cols-2 gap-4">
              {!editing && (
                <Field label="Advance amount (Rs)">
                  <Input
                    type="number"
                    min={0}
                    value={advanceRupees}
                    onChange={(e) => setAdvanceRupees(e.target.value)}
                  />
                </Field>
              )}
              {!editing && (
                <>
                  <Field label="Payment method">
                    <Select
                      value={paymentMethod}
                      onValueChange={(v) => setPaymentMethod(v as typeof paymentMethod)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="bank">Bank</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                        <SelectItem value="easypaisa">Easypaisa</SelectItem>
                        <SelectItem value="jazzcash">JazzCash</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Payment date">
                    <Input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                    />
                  </Field>
                  <Field label="Reference / cheque no">
                    <Input
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                    />
                  </Field>
                  <Field label="Balance due">
                    <Input value={formatPKR(balance)} disabled />
                  </Field>
                </>
              )}
              {!usePaymentPlan && (
                <Field label="Due date">
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </Field>
              )}
            </div>

            {!editing && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={usePaymentPlan}
                  onCheckedChange={(v) => setUsePaymentPlan(v === true)}
                />
                Use a payment plan instead of a single due date
              </label>
            )}

            {usePaymentPlan && (
              <div className="flex flex-col gap-3 rounded-md border p-3">
                <div className="flex items-end gap-2">
                  <Field label="Split evenly into">
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      className="w-24"
                      value={splitCount}
                      onChange={(e) => setSplitCount(e.target.value)}
                    />
                  </Field>
                  <Button type="button" variant="outline" onClick={splitEvenly}>
                    Generate
                  </Button>
                </div>

                {installmentRows.map((row, i) => (
                  <div key={i} className="flex items-end gap-2">
                    <Field label="Label">
                      <Input
                        value={row.label}
                        onChange={(e) =>
                          setInstallmentRows((prev) =>
                            prev.map((r, idx) => (idx === i ? { ...r, label: e.target.value } : r)),
                          )
                        }
                      />
                    </Field>
                    <Field label="Amount (Rs)">
                      <Input
                        type="number"
                        className="w-32"
                        value={row.amountRupees}
                        onChange={(e) =>
                          setInstallmentRows((prev) =>
                            prev.map((r, idx) =>
                              idx === i ? { ...r, amountRupees: e.target.value } : r,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Field label="Due date">
                      <Input
                        type="date"
                        value={row.dueDate}
                        onChange={(e) =>
                          setInstallmentRows((prev) =>
                            prev.map((r, idx) => (idx === i ? { ...r, dueDate: e.target.value } : r)),
                          )
                        }
                      />
                    </Field>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setInstallmentRows((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="self-start"
                  onClick={() =>
                    setInstallmentRows((prev) => [...prev, { label: "", amountRupees: "", dueDate: "" }])
                  }
                >
                  Add step
                </Button>

                <p
                  className={`text-sm ${installmentRemainder === 0 ? "text-green-600" : "text-destructive"}`}
                >
                  {installmentRemainder === 0
                    ? "✓ Plan reconciles to the grand total."
                    : `Remaining to allocate: ${formatPKR(installmentRemainder)}`}
                </p>
              </div>
            )}

            <Field label="Internal notes (never printed)">
              <Textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
            </Field>
            <Field label="Client notes (printed on invoice)">
              <Textarea value={clientNotes} onChange={(e) => setClientNotes(e.target.value)} />
            </Field>
            <Field label="Special instructions (printed on function sheet)">
              <Textarea
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
              />
            </Field>
          </div>
        )}

        {stepError && <p className="mt-3 text-sm text-destructive">{stepError}</p>}
        {submitError && <p className="mt-3 text-sm text-destructive">{submitError}</p>}

        <div className="mt-6 flex justify-between">
          <Button type="button" variant="outline" onClick={back} disabled={step === 0}>
            Back
          </Button>
          {step < STEP_TITLES.length - 1 ? (
            <Button type="button" onClick={next}>
              Next
            </Button>
          ) : (
            <Button type="button" onClick={submit} disabled={submitting}>
              {submitting ? "Saving…" : editing ? "Save changes" : "Create booking"}
            </Button>
          )}
        </div>
      </div>

      <LiveSummary
        clientName={clientName}
        eventDate={eventDate}
        eventSlot={eventSlot}
        guestCount={Number(guestCount) || 0}
        hallRent={hallRentPaisa}
        subtotal={totals.subtotal}
        discount={totals.discount}
        taxAmount={totals.taxAmount}
        grandTotal={totals.grandTotal}
        advancePaisa={advancePaisa}
        alreadyPaidPaisa={editing?.amountPaidPaisa}
      />
    </div>
  );
}
