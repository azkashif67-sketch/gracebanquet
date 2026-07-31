import { redirect } from "next/navigation";
import { isSetupComplete } from "@/lib/db/queries/setup";
import { SetupWizard } from "@/components/auth/setup-wizard";

export default async function SetupPage() {
  if (await isSetupComplete()) redirect("/login");

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <SetupWizard />
    </div>
  );
}
