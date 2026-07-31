"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { createTax, updateTax, type TaxInput } from "@/app/(admin)/taxes/actions";
import { Field } from "@/components/form-field";

export interface TaxFormDialogProps {
  trigger: React.ReactElement;
  taxId?: string;
  initial?: TaxInput;
}

const EMPTY: TaxInput = {
  name: "",
  type: "sales_tax",
  ratePercent: 0,
  isDefault: false,
  active: true,
};

export function TaxFormDialog({ trigger, taxId, initial }: TaxFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<TaxInput>(initial ?? EMPTY);
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(undefined);
    const result = taxId ? await updateTax(taxId, form) : await createTax(form);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{taxId ? "Edit tax" : "Add tax"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="Type">
            <Select
              value={form.type}
              onValueChange={(v) => setForm({ ...form, type: v as TaxInput["type"] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sales_tax">Sales Tax</SelectItem>
                <SelectItem value="service_charge">Service Charge</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Rate (%)">
            <Input
              type="number"
              step="0.01"
              min={0}
              max={100}
              value={form.ratePercent}
              onChange={(e) => setForm({ ...form, ratePercent: Number(e.target.value) })}
              required
            />
          </Field>
          <div className="flex items-center justify-between">
            <Label>Applied by default</Label>
            <Switch
              checked={form.isDefault}
              onCheckedChange={(v) => setForm({ ...form, isDefault: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Active</Label>
            <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
          </div>
          {taxId && (
            <p className="text-xs text-muted-foreground">
              Changing the rate affects future bookings only — issued invoices keep the rate
              that was in effect when they were saved.
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
