import Link from "next/link";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import type { MonthBooking } from "@/lib/db/queries/bookings";

const STATUS_COLOR: Record<string, string> = {
  confirmed: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  tentative: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  completed: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200",
};

const VACANT = "bg-green-50 text-green-800 hover:bg-green-100 dark:bg-green-950/40 dark:text-green-300";

export function MonthCalendar({
  monthDate,
  bookings,
  hallFilter,
}: {
  monthDate: Date;
  bookings: MonthBooking[];
  hallFilter?: string;
}) {
  const start = startOfWeek(startOfMonth(monthDate));
  const end = endOfWeek(endOfMonth(monthDate));
  const days = eachDayOfInterval({ start, end });

  const byDate = new Map<string, MonthBooking[]>();
  for (const b of bookings) {
    const key = b.eventDate;
    (byDate.get(key) ?? byDate.set(key, []).get(key)!).push(b);
  }

  const prevMonth = format(subMonths(monthDate, 1), "yyyy-MM");
  const nextMonth = format(addMonths(monthDate, 1), "yyyy-MM");
  const hallQuery = hallFilter ? `&hall=${encodeURIComponent(hallFilter)}` : "";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Link
          href={`/schedule?month=${prevMonth}${hallQuery}`}
          className="rounded-md border px-3 py-1 text-sm hover:bg-muted"
        >
          ← Prev
        </Link>
        <h2 className="text-lg font-semibold">{format(monthDate, "MMMM yyyy")}</h2>
        <Link
          href={`/schedule?month=${nextMonth}${hallQuery}`}
          className="rounded-md border px-3 py-1 text-sm hover:bg-muted"
        >
          Next →
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-1 text-xs font-medium text-muted-foreground">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="px-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const inMonth = isSameMonth(day, monthDate);
          const dayBookings = byDate.get(dateKey) ?? [];
          const daySlot = dayBookings.filter((b) => b.eventSlot === "day");
          const nightSlot = dayBookings.filter((b) => b.eventSlot === "night");

          return (
            <div
              key={dateKey}
              className={`flex min-h-24 flex-col gap-1 rounded-md border p-1 text-xs ${
                inMonth ? "" : "opacity-40"
              } ${isToday(day) ? "border-primary" : ""}`}
            >
              <div className="text-right text-muted-foreground">{format(day, "d")}</div>
              <SlotStrip label="Day" dateKey={dateKey} slot="day" bookings={daySlot} hallFilter={hallFilter} />
              <SlotStrip label="Night" dateKey={dateKey} slot="night" bookings={nightSlot} hallFilter={hallFilter} />
            </div>
          );
        })}
      </div>

      <div className="flex gap-4 text-xs text-muted-foreground">
        <Legend color="bg-green-100 dark:bg-green-950/40" label="Vacant" />
        <Legend color="bg-red-100 dark:bg-red-950" label="Confirmed" />
        <Legend color="bg-amber-100 dark:bg-amber-950" label="Tentative" />
        <Legend color="bg-blue-100 dark:bg-blue-950" label="Completed" />
      </div>
    </div>
  );
}

function SlotStrip({
  label,
  dateKey,
  slot,
  bookings,
  hallFilter,
}: {
  label: string;
  dateKey: string;
  slot: "day" | "night";
  bookings: MonthBooking[];
  hallFilter?: string;
}) {
  if (bookings.length === 0) {
    const params = new URLSearchParams({ date: dateKey, slot });
    if (hallFilter) params.set("hall", hallFilter);
    return (
      <Link
        href={`/bookings/new?${params.toString()}`}
        className={`rounded px-1 py-0.5 ${VACANT}`}
        title={`${label} — vacant`}
      >
        {label}: —
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {bookings.map((b) => (
        <Link
          key={b.id}
          href={`/bookings/${b.id}`}
          className={`truncate rounded px-1 py-0.5 ${STATUS_COLOR[b.status] ?? "bg-muted"}`}
          title={`${b.clientName} · ${b.guestCount} guests · ${b.phone}`}
        >
          {label}: {b.clientName}
          {bookings.length > 1 ? ` (${b.hallSection})` : ""}
        </Link>
      ))}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className={`inline-block h-3 w-3 rounded ${color}`} />
      {label}
    </div>
  );
}
