import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Venue/invoice/financial/operations/system/integrations settings tabs,
// recycle bin, and backup are Phase 4 scope (spec §15).
export default async function SettingsPage() {
  await requireRole("admin");

  const cards = [
    { href: "/settings/users", title: "Users", description: "Manage staff accounts, roles, and access." },
    { href: "/settings/audit", title: "Audit Log", description: "Read-only history of every mutation." },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Admin Settings</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Link key={c.href} href={c.href}>
            <Card className="h-full transition-colors hover:bg-muted/40">
              <CardHeader>
                <CardTitle className="text-base">{c.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{c.description}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        System settings (venue details, invoice numbering, operations, integrations), recycle bin,
        and backups land in a later phase.
      </p>
    </div>
  );
}
