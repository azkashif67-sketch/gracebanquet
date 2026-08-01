"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/form-field";
import { createInquiry } from "@/app/(admin)/inquiries/actions";
import type { VenueSettings } from "@/lib/db/queries/settings";

export function InquiryForm({ settings }: { settings: VenueSettings }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [eventType, setEventType] = useState<string>("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredSlot, setPreferredSlot] = useState<string>("");
  const [guestEstimate, setGuestEstimate] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(undefined);

    const result = await createInquiry({
      name,
      phone,
      email: email || undefined,
      eventType: eventType || undefined,
      preferredDate: preferredDate || undefined,
      preferredSlot: preferredSlot === "day" || preferredSlot === "night" ? preferredSlot : undefined,
      guestEstimate: guestEstimate ? Number(guestEstimate) : undefined,
      message,
    });
    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Phone">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </Field>
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Event type">
          <Select value={eventType} onValueChange={(v) => setEventType(v ?? "")}>
            <SelectTrigger>
              <SelectValue placeholder="Select…" />
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
        <Field label="Preferred date">
          <Input type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} />
        </Field>
        <Field label="Preferred slot">
          <Select value={preferredSlot} onValueChange={(v) => setPreferredSlot(v ?? "")}>
            <SelectTrigger>
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">{settings.slots.day.label}</SelectItem>
              <SelectItem value="night">{settings.slots.night.label}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Estimated guests">
          <Input type="number" value={guestEstimate} onChange={(e) => setGuestEstimate(e.target.value)} />
        </Field>
      </div>

      <Field label="Message / notes">
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} required />
      </Field>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Log inquiry"}
      </Button>
    </form>
  );
}
