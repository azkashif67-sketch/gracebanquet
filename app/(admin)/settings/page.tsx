import { requireRole } from "@/lib/auth/require-role";

// Full Admin Settings (venue/invoice/financial/operations/system/integrations
// tabs, users, audit log, recycle bin, backup) is Phase 3-4 scope (spec §15).
export default async function SettingsPage() {
  await requireRole("admin");

  return (
    <div>
      <h1 className="text-2xl font-semibold">Admin Settings</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        User management, system settings, audit log, and recycle bin land in a later phase.
      </p>
    </div>
  );
}
