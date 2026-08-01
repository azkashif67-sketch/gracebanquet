import Link from "next/link";
import { requireAuth } from "@/lib/auth/require-role";
import { getDuesAlerts } from "@/lib/db/queries/bookings";
import { countNewInquiries } from "@/lib/db/queries/inquiries";
import { getKpis, getLatestBookings, getBalancesDueThisWeek, getRecentActivity } from "@/lib/db/queries/dashboard";
import { resolvePeriod, type PeriodKey } from "@/lib/dashboard-period";
import { formatPKR } from "@/lib/calculations";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertBar, type AlertPill } from "@/components/dashboard/alert-bar";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "this_quarter", label: "This Quarter" },
  { key: "this_year", label: "This Year" },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await requireAuth();
  const params = await searchParams;
  const isStaff = user.role === "staff";

  const [dues, newInquiries] = await Promise.all([getDuesAlerts(), countNewInquiries()]);

  const pills: AlertPill[] = [];
  if (!isStaff && dues.overdue.length > 0) {
    const total = dues.overdue.reduce((s, b) => s + b.balanceDue, 0);
    pills.push({
      id: "overdue",
      color: "red",
      text: `${dues.overdue.length} booking${dues.overdue.length === 1 ? "" : "s"} overdue — ${formatPKR(total)} outstanding`,
      href: "/reports/receivables",
    });
  }
  if (!isStaff && dues.dueSoon.length > 0) {
    pills.push({
      id: "due_soon",
      color: "amber",
      text: `${dues.dueSoon.length} payment${dues.dueSoon.length === 1 ? "" : "s"} due this week`,
      href: "/invoices?status=partial",
    });
  }
  if (dues.eventTomorrow.length > 0) {
    for (const b of dues.eventTomorrow) {
      pills.push({
        id: `tomorrow-${b.id}`,
        color: "blue",
        text: `Event tomorrow: ${b.clientName}${!isStaff && b.balanceDue > 0 ? ` — ${formatPKR(b.balanceDue)} pending` : ""}`,
        href: `/bookings/${b.id}`,
      });
    }
  }
  if (!isStaff && dues.expiringHolds.length > 0) {
    pills.push({
      id: "holds",
      color: "orange",
      text: `${dues.expiringHolds.length} hold${dues.expiringHolds.length === 1 ? "" : "s"} expiring soon`,
      href: "/bookings?status=tentative",
    });
  }
  if (newInquiries > 0) {
    pills.push({
      id: "inquiries",
      color: "grey",
      text: `${newInquiries} new inquir${newInquiries === 1 ? "y" : "ies"}`,
      href: "/inquiries?status=new",
    });
  }

  if (isStaff) {
    const latest = await getLatestBookings(5);
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">Welcome, {user.fullName}</h1>
        <AlertBar pills={pills} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Latest Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Event Date</TableHead>
                  <TableHead>Slot</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {latest.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <Link href={`/bookings/${b.id}`} className="text-primary hover:underline">
                        {b.invoiceNo ?? "(draft)"}
                      </Link>
                    </TableCell>
                    <TableCell>{b.clientName}</TableCell>
                    <TableCell>{b.eventDate}</TableCell>
                    <TableCell className="capitalize">{b.eventSlot}</TableCell>
                    <TableCell>
                      <Badge className="capitalize">{b.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  const period = resolvePeriod(params.period);
  const [kpis, latest, dueThisWeek, activity] = await Promise.all([
    getKpis(period.from, period.to),
    getLatestBookings(5),
    getBalancesDueThisWeek(),
    getRecentActivity(8),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Welcome, {user.fullName}</h1>
      <AlertBar pills={pills} />

      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Overview</h2>
        <div className="flex gap-1 text-sm">
          {PERIODS.map((p) => (
            <Link
              key={p.key}
              href={`/dashboard?period=${p.key}`}
              className={`rounded-md px-3 py-1 ${period.label === p.label ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Bookings" value={String(kpis.bookingsCount)} />
        <KpiCard label="Cash Collected" value={formatPKR(kpis.cashCollected)} />
        <KpiCard label="Outstanding" value={formatPKR(kpis.outstanding)} />
        <KpiCard label="Expenses" value={formatPKR(kpis.expensesTotal)} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Latest 5 Bookings</CardTitle>
          <Link href="/bookings" className="text-sm text-primary hover:underline">
            View all →
          </Link>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Event Date</TableHead>
                <TableHead>Slot</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {latest.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <Link href={`/bookings/${b.id}`} className="text-primary hover:underline">
                      {b.invoiceNo ?? "(draft)"}
                    </Link>
                  </TableCell>
                  <TableCell>{b.clientName}</TableCell>
                  <TableCell>{b.eventDate}</TableCell>
                  <TableCell className="capitalize">{b.eventSlot}</TableCell>
                  <TableCell>{formatPKR(b.grandTotal)}</TableCell>
                  <TableCell>
                    <Badge className="capitalize">{b.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Due This Week</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Event Date</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Due Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dueThisWeek.map((b) => (
                <TableRow key={b.id} className="bg-amber-50 dark:bg-amber-950/20">
                  <TableCell>
                    <Link href={`/bookings/${b.id}`} className="text-primary hover:underline">
                      {b.clientName}
                    </Link>
                  </TableCell>
                  <TableCell>{b.phone}</TableCell>
                  <TableCell>{b.eventDate}</TableCell>
                  <TableCell>{formatPKR(b.balanceDue)}</TableCell>
                  <TableCell>{b.dueDate}</TableCell>
                </TableRow>
              ))}
              {dueThisWeek.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nothing due this week.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {activity.map((a) => (
            <p key={a.id}>
              <span className="font-medium">{a.actorName}</span>{" "}
              <span className="text-muted-foreground">{a.summary}</span>{" "}
              <span className="text-xs text-muted-foreground">
                · {new Date(a.createdAt * 1000).toLocaleString("en-PK")}
              </span>
            </p>
          ))}
          {activity.length === 0 && <p className="text-muted-foreground">No activity yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
