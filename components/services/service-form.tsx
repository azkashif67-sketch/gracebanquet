"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createService, updateService, type ServiceInput } from "@/app/(admin)/services/actions";
import { Field } from "@/components/form-field";

const CATEGORIES = [
  "sound",
  "lighting",
  "entry",
  "decor",
  "catering",
  "photography",
  "furniture",
  "misc",
] as const;

const PRICING_TYPES = ["fixed", "per_head", "per_hour", "per_unit"] as const;

const MENU_TYPES = ["starter", "main", "rice", "bbq", "bread", "side", "dessert", "drink"] as const;

type MenuRow = { name: string; type: (typeof MENU_TYPES)[number] };

export interface ServiceFormProps {
  serviceId?: string;
  initial?: {
    name: string;
    category: (typeof CATEGORIES)[number];
    description?: string;
    pricingType: (typeof PRICING_TYPES)[number];
    rateRupees: number;
    taxable: boolean;
    active: boolean;
    menuItems: MenuRow[];
  };
}

export function ServiceForm({ serviceId, initial }: ServiceFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>(
    initial?.category ?? "sound",
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [pricingType, setPricingType] = useState<(typeof PRICING_TYPES)[number]>(
    initial?.pricingType ?? "fixed",
  );
  const [rate, setRate] = useState(String(initial?.rateRupees ?? ""));
  const [taxable, setTaxable] = useState(initial?.taxable ?? true);
  const [active, setActive] = useState(initial?.active ?? true);
  const [menu, setMenu] = useState<MenuRow[]>(initial?.menuItems ?? []);
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(undefined);

    const input: ServiceInput = {
      name,
      category,
      description,
      pricingType,
      ratePaisa: Math.round(Number(rate) * 100),
      taxable,
      active,
      menuItems: category === "catering" ? menu.map((m) => ({ name: m.name, type: m.type })) : [],
    };

    const result = serviceId ? await updateService(serviceId, input) : await createService(input);
    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-4">
      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>

      <Field label="Category">
        <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c} className="capitalize">
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Description">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Pricing type">
          <Select value={pricingType} onValueChange={(v) => setPricingType(v as typeof pricingType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRICING_TYPES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Rate (Rs)">
          <Input type="number" min={0} value={rate} onChange={(e) => setRate(e.target.value)} required />
        </Field>
      </div>

      <div className="flex items-center justify-between">
        <Label>Taxable</Label>
        <Switch checked={taxable} onCheckedChange={setTaxable} />
      </div>
      <div className="flex items-center justify-between">
        <Label>Active</Label>
        <Switch checked={active} onCheckedChange={setActive} />
      </div>

      {category === "catering" && (
        <MenuBuilder menu={menu} setMenu={setMenu} />
      )}

      {serviceId && (
        <p className="text-xs text-muted-foreground">
          Changing the rate does not affect existing bookings — they keep the price agreed at
          the time. Editing the default menu does not alter menus already saved onto bookings.
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Save service"}
      </Button>
    </form>
  );
}

function MenuBuilder({
  menu,
  setMenu,
}: {
  menu: MenuRow[];
  setMenu: React.Dispatch<React.SetStateAction<MenuRow[]>>;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <Label>Default menu items</Label>
      {menu.map((item, i) => (
        <div key={i} className="flex gap-2">
          <Input
            placeholder="Item name"
            value={item.name}
            onChange={(e) =>
              setMenu((prev) => prev.map((m, idx) => (idx === i ? { ...m, name: e.target.value } : m)))
            }
          />
          <Select
            value={item.type}
            onValueChange={(v) =>
              setMenu((prev) =>
                prev.map((m, idx) => (idx === i ? { ...m, type: v as MenuRow["type"] } : m)),
              )
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MENU_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setMenu((prev) => prev.filter((_, idx) => idx !== i))}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() => setMenu((prev) => [...prev, { name: "", type: "main" }])}
      >
        Add item
      </Button>
    </div>
  );
}
