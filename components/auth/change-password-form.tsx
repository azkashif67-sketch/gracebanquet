"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { changePassword, type ChangePasswordState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/form-field";

const initialState: ChangePasswordState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Saving…" : "Change password"}
    </Button>
  );
}

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const [state, formAction] = useActionState(changePassword, initialState);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-base">
          {forced ? "Choose a new password" : "Change password"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          {forced && (
            <p className="text-sm text-muted-foreground">
              Your account was set up with a temporary password. Pick your own before continuing.
            </p>
          )}

          {/* Someone forced to change their password may never have known the
              old one (an admin set it), so don't ask for it. */}
          {!forced && (
            <Field label="Current password">
              <Input id="currentPassword" name="currentPassword" type="password" required />
            </Field>
          )}
          <Field label="New password">
            <Input id="newPassword" name="newPassword" type="password" required />
          </Field>
          <Field label="Confirm new password">
            <Input id="confirmPassword" name="confirmPassword" type="password" required />
          </Field>

          <p className="text-xs text-muted-foreground">
            At least 8 characters, including a number.
          </p>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}
