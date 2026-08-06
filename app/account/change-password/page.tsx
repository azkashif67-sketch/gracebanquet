import { redirect } from "next/navigation";
import { validateRequest } from "@/lib/auth/session";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

export default async function ChangePasswordPage() {
  const { user } = await validateRequest();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <ChangePasswordForm forced={Boolean(user.mustChangePassword)} />
    </div>
  );
}
