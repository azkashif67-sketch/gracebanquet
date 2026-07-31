import Link from "next/link";
import { requireAuth } from "@/lib/auth/require-role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Full dashboard (alerts, KPIs, latest bookings, due-this-week, activity feed)
// is Phase 3 scope (spec §7.3–§7.6). This is a minimal landing page so the
// Phase 1 core loop — create a booking, print it, see it on the calendar —
// has somewhere to start from.
export default async function DashboardPage() {
  const user = await requireAuth();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Welcome, {user.fullName}</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <QuickLink href="/bookings/new" title="New Booking" description="Start the 4-step booking wizard" />
        <QuickLink href="/schedule" title="Schedule" description="View the booking calendar" />
        <QuickLink href="/bookings" title="Bookings" description="Browse and search all bookings" />
      </div>
    </div>
  );
}

function QuickLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href}>
      <Card className="transition-colors hover:bg-muted/40">
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{description}</CardContent>
      </Card>
    </Link>
  );
}
