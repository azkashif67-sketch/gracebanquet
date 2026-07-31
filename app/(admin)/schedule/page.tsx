import Link from "next/link";
import { format, parse } from "date-fns";
import { requireAuth } from "@/lib/auth/require-role";
import { listBookingsInRange } from "@/lib/db/queries/bookings";
import { getVenueSettings } from "@/lib/db/queries/settings";
import { MonthCalendar } from "@/components/schedule/month-calendar";

// Month view only for Phase 1 (spec §9.7 also defines Week/List/Year views —
// deferred; the month grid is the operational core of daily use).
export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; hall?: string }>;
}) {
  await requireAuth();
  const { month, hall } = await searchParams;

  const monthDate = month ? parse(month, "yyyy-MM", new Date()) : new Date();
  const monthStart = format(monthDate, "yyyy-MM-01");
  const monthEndDate = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const monthEnd = format(monthEndDate, "yyyy-MM-dd");

  const [bookings, settings] = await Promise.all([
    listBookingsInRange(monthStart, monthEnd, hall),
    getVenueSettings(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Schedule</h1>
        {settings.halls.length > 1 && (
          <div className="flex gap-1 text-sm">
            <Link
              href={`/schedule?month=${format(monthDate, "yyyy-MM")}`}
              className={`rounded-md px-3 py-1 ${!hall ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              All halls
            </Link>
            {settings.halls.map((h) => (
              <Link
                key={h}
                href={`/schedule?month=${format(monthDate, "yyyy-MM")}&hall=${encodeURIComponent(h)}`}
                className={`rounded-md px-3 py-1 ${hall === h ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                {h}
              </Link>
            ))}
          </div>
        )}
      </div>

      <MonthCalendar monthDate={monthDate} bookings={bookings} hallFilter={hall} />
    </div>
  );
}
