import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ReportsPage() {
  const user = await requireRole("admin", "manager");

  const cards = [
    { href: "/reports/revenue", title: "Monthly Booking Revenue", description: "Revenue, discounts, and collections by event date." },
    { href: "/reports/receivables", title: "Outstanding Receivables", description: "Every open balance, aged by days overdue." },
    ...(user.role === "admin"
      ? [{ href: "/reports/tax", title: "Monthly Tax Report", description: "Tax collected per invoice, grouped by tax — built for FBR filing." }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Reports</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
    </div>
  );
}
