import { redirect } from "next/navigation";
import { validateRequest } from "@/lib/auth/session";
import { isSetupComplete } from "@/lib/db/queries/setup";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  if (!(await isSetupComplete())) redirect("/setup");

  const { user } = await validateRequest();
  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <LoginForm />
    </div>
  );
}
