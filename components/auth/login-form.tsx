"use client";

import { useActionState } from "react";
import { useState } from "react";
import { login, type LoginState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const REMEMBER_KEY = "venue_remembered_username";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);
  const [remember, setRemember] = useState(false);
  const [username, setUsername] = useState(() =>
    typeof window !== "undefined" ? (localStorage.getItem(REMEMBER_KEY) ?? "") : "",
  );

  function handleSubmit(formData: FormData) {
    if (remember) {
      localStorage.setItem(REMEMBER_KEY, String(formData.get("username") ?? ""));
    } else {
      localStorage.removeItem(REMEMBER_KEY);
    }
    return formAction(formData);
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-center text-xl">Grace Banquet</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="remember"
              checked={remember}
              onCheckedChange={(v) => setRemember(v === true)}
            />
            <Label htmlFor="remember" className="text-sm font-normal">
              Remember username
            </Label>
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Signing in…" : "Login"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
