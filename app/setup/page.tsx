import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { SetupWizard } from "@/components/auth/setup-wizard";

export default async function SetupPage() {
  const existing = await db.query.users.findFirst({ columns: { id: true } });
  if (existing) redirect("/login");

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <SetupWizard />
    </div>
  );
}
