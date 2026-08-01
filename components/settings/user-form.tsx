"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/form-field";
import { createUser, updateUser } from "@/app/(admin)/settings/users/actions";

const ROLES = ["admin", "manager", "staff"] as const;

export interface UserFormProps {
  userId?: string;
  initial?: {
    fullName: string;
    username: string;
    email?: string;
    role: (typeof ROLES)[number];
    phone?: string;
    active: boolean;
  };
}

export function UserForm({ userId, initial }: UserFormProps) {
  const [fullName, setFullName] = useState(initial?.fullName ?? "");
  const [username, setUsername] = useState(initial?.username ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>(initial?.role ?? "staff");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(undefined);

    const result = userId
      ? await updateUser(userId, {
          fullName,
          username,
          email: email || undefined,
          password: password || undefined,
          role,
          phone: phone || undefined,
          active,
        })
      : await createUser({
          fullName,
          username,
          email: email || undefined,
          password,
          role,
          phone: phone || undefined,
          active,
        });

    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
      <Field label="Full name">
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </Field>
      <Field label="Username">
        <Input value={username} onChange={(e) => setUsername(e.target.value)} required />
      </Field>
      <Field label="Email">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label={userId ? "New password (leave blank to keep current)" : "Password"}>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required={!userId}
        />
      </Field>
      <Field label="Role">
        <Select value={role} onValueChange={(v) => setRole((v ?? "staff") as typeof role)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r} className="capitalize">
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Phone">
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <div className="flex items-center justify-between">
        <label className="text-sm">Active</label>
        <Switch checked={active} onCheckedChange={setActive} />
      </div>

      {userId && (
        <p className="text-xs text-muted-foreground">
          Setting a new password invalidates this user&apos;s sessions immediately and forces them
          to choose a new password on next login.
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Save user"}
      </Button>
    </form>
  );
}
