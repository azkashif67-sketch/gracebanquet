"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { completeSetup, type SetupInput } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/form-field";

type Hall = { name: string; capacity: string };

const STEP_TITLES = [
  "Admin account",
  "Venue details",
  "Financial defaults",
  "Operations",
  "Recovery key",
];

function generateRecoveryKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32)
    .toUpperCase();
}

export function SetupWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  // Step 1
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Step 2
  const [venueName, setVenueName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [ntn, setNtn] = useState("");

  // Step 3
  const [taxLabel, setTaxLabel] = useState("Punjab Sales Tax");
  const [taxRatePercent, setTaxRatePercent] = useState("16");
  const [invoicePrefix, setInvoicePrefix] = useState("INV");

  // Step 4
  const [halls, setHalls] = useState<Hall[]>([{ name: "Main Hall", capacity: "" }]);
  const [daySlotStart, setDaySlotStart] = useState("12:00");
  const [daySlotEnd, setDaySlotEnd] = useState("17:00");
  const [nightSlotStart, setNightSlotStart] = useState("19:00");
  const [nightSlotEnd, setNightSlotEnd] = useState("00:00");

  // Step 5
  const recoveryKey = useMemo(() => generateRecoveryKey(), []);
  const [confirmedSaved, setConfirmedSaved] = useState(false);

  function stepError(): string | undefined {
    if (step === 0) {
      if (fullName.trim().length < 2) return "Enter the admin's full name.";
      if (username.trim().length < 3) return "Username must be at least 3 characters.";
      if (password.length < 8 || !/\d/.test(password))
        return "Password must be at least 8 characters and include a number.";
      if (password !== confirmPassword) return "Passwords do not match.";
    }
    if (step === 1) {
      if (venueName.trim().length < 1) return "Venue name is required.";
    }
    if (step === 2) {
      const rate = Number(taxRatePercent);
      if (taxLabel.trim().length < 1) return "Tax label is required.";
      if (Number.isNaN(rate) || rate < 0 || rate > 100) return "Tax rate must be between 0 and 100.";
      if (invoicePrefix.trim().length < 1) return "Invoice prefix is required.";
    }
    if (step === 3) {
      if (halls.length === 0 || halls.some((h) => h.name.trim().length === 0))
        return "Every hall/section needs a name.";
    }
    if (step === 4) {
      if (!confirmedSaved) return "Confirm you've saved the recovery key before continuing.";
    }
    return undefined;
  }

  function next() {
    const err = stepError();
    if (err) {
      setError(err);
      return;
    }
    setError(undefined);
    setStep((s) => Math.min(s + 1, STEP_TITLES.length - 1));
  }

  function back() {
    setError(undefined);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function submit() {
    const err = stepError();
    if (err) {
      setError(err);
      return;
    }
    setPending(true);
    setError(undefined);

    const input: SetupInput = {
      fullName,
      username,
      password,
      venueName,
      address,
      phone,
      email,
      ntn,
      taxLabel,
      taxRatePercent: Number(taxRatePercent),
      invoicePrefix,
      halls: halls.map((h) => ({
        name: h.name,
        capacity: h.capacity ? Number(h.capacity) : undefined,
      })),
      daySlotStart,
      daySlotEnd,
      nightSlotStart,
      nightSlotEnd,
      recoveryKey,
    };

    try {
      const result = await completeSetup(input);
      if (result?.error) {
        setError(result.error);
        setPending(false);
        return;
      }
      // completeSetup redirects on success (throws NEXT_REDIRECT); if we get
      // here without an error, fall back to a client-side redirect.
      router.push("/dashboard");
    } catch (e) {
      // Next.js redirect() throws internally — let it propagate.
      throw e;
    }
  }

  function updateHall(index: number, patch: Partial<Hall>) {
    setHalls((prev) => prev.map((h, i) => (i === index ? { ...h, ...patch } : h)));
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>
          Step {step + 1} of {STEP_TITLES.length}: {STEP_TITLES[step]}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {step === 0 && (
          <>
            <Field label="Full name">
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </Field>
            <Field label="Username">
              <Input value={username} onChange={(e) => setUsername(e.target.value)} />
            </Field>
            <Field label="Password">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Field label="Confirm password">
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <Field label="Venue name">
              <Input value={venueName} onChange={(e) => setVenueName(e.target.value)} />
            </Field>
            <Field label="Address">
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </Field>
            <Field label="Phone">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="NTN">
              <Input value={ntn} onChange={(e) => setNtn(e.target.value)} />
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <Field label="Tax label">
              <Input value={taxLabel} onChange={(e) => setTaxLabel(e.target.value)} />
            </Field>
            <Field label="Tax rate (%)">
              <Input
                type="number"
                value={taxRatePercent}
                onChange={(e) => setTaxRatePercent(e.target.value)}
              />
            </Field>
            <Field label="Invoice prefix">
              <Input value={invoicePrefix} onChange={(e) => setInvoicePrefix(e.target.value)} />
            </Field>
          </>
        )}

        {step === 3 && (
          <>
            <div className="flex flex-col gap-2">
              <Label>Halls / sections</Label>
              {halls.map((h, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder="Name"
                    value={h.name}
                    onChange={(e) => updateHall(i, { name: e.target.value })}
                  />
                  <Input
                    placeholder="Capacity"
                    type="number"
                    className="w-32"
                    value={h.capacity}
                    onChange={(e) => updateHall(i, { capacity: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={halls.length === 1}
                    onClick={() => setHalls((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => setHalls((prev) => [...prev, { name: "", capacity: "" }])}
              >
                Add hall
              </Button>
              <p className="text-xs text-muted-foreground">
                A &ldquo;Full Venue&rdquo; option is added automatically and blocks/is blocked by every section.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Day slot start">
                <Input value={daySlotStart} onChange={(e) => setDaySlotStart(e.target.value)} />
              </Field>
              <Field label="Day slot end">
                <Input value={daySlotEnd} onChange={(e) => setDaySlotEnd(e.target.value)} />
              </Field>
              <Field label="Night slot start">
                <Input value={nightSlotStart} onChange={(e) => setNightSlotStart(e.target.value)} />
              </Field>
              <Field label="Night slot end">
                <Input value={nightSlotEnd} onChange={(e) => setNightSlotEnd(e.target.value)} />
              </Field>
            </div>
          </>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              This recovery key is the only way to reset the admin password if it&apos;s lost and
              no other admin exists. It is shown once, right now, and never stored in plain
              text — only its hash is saved.
            </p>
            <pre className="rounded-md border bg-muted p-3 text-center font-mono text-lg tracking-widest select-all">
              {recoveryKey}
            </pre>
            <div className="flex items-center gap-2">
              <Checkbox
                id="saved"
                checked={confirmedSaved}
                onCheckedChange={(v) => setConfirmedSaved(v === true)}
              />
              <Label htmlFor="saved" className="text-sm font-normal">
                I have saved this recovery key somewhere safe.
              </Label>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-between pt-2">
          <Button type="button" variant="outline" onClick={back} disabled={step === 0 || pending}>
            Back
          </Button>
          {step < STEP_TITLES.length - 1 ? (
            <Button type="button" onClick={next}>
              Next
            </Button>
          ) : (
            <Button type="button" onClick={submit} disabled={pending}>
              {pending ? "Setting up…" : "Finish setup"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
