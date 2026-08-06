import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { getProfitLoss } from "@/lib/db/queries/reports";
import { resolvePeriod, type PeriodKey } from "@/lib/dashboard-period";
import { formatPKR } from "@/lib/calculations";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "this_quarter", label: "This Quarter" },
  { key: "this_year", label: "This Year" },
];

const CATEGORY_LABEL = (c: string) => c.replace(/_/g, " ");

export default async function ProfitLossPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  await requireRole("admin");
  const params = await searchParams;

  const period = resolvePeriod(params.period, params.from, params.to);
  const pl = await getProfitLoss(period.from, period.to);
  const isProfit = pl.netProfit >= 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Profit &amp; Loss</h1>
        <p className="text-sm text-muted-foreground">
          {period.from} to {period.to} · Revenue is attributed to the month the event is held.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <Link
            key={p.key}
            href={`/reports/profit-loss?period=${p.key}`}
            className={`rounded-md px-3 py-1 text-sm ${
              period.label === p.label ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="period" value="custom" />
        <div className="flex flex-col gap-1">
          <label className="text-sm text-muted-foreground">From</label>
          <Input type="date" name="from" defaultValue={period.from} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-muted-foreground">To</label>
          <Input type="date" name="to" defaultValue={period.to} />
        </div>
        <Button type="submit" variant="outline">
          Apply
        </Button>
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Net Revenue</p>
            <p className="text-lg font-semibold">{formatPKR(pl.netRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Total Expenses</p>
            <p className="text-lg font-semibold">{formatPKR(pl.totalExpenses)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">{isProfit ? "Net Profit" : "Net Loss"}</p>
            <p
              className={`text-lg font-semibold ${
                isProfit ? "text-green-600 dark:text-green-500" : "text-destructive"
              }`}
            >
              {formatPKR(Math.abs(pl.netProfit))}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-1 pt-6 text-sm">
          <p className="mb-1 font-semibold uppercase tracking-wide">Revenue</p>
          <Line label="Booking revenue" value={pl.bookingRevenue} />
          {pl.forfeitedAdvances > 0 && (
            <Line label="Forfeited advances (cancelled bookings)" value={pl.forfeitedAdvances} />
          )}
          <Line label="Gross revenue" value={pl.grossRevenue} bold border />
          <Line label="Less: sales tax payable" value={-pl.salesTaxPayable} />
          <Line label="Net revenue" value={pl.netRevenue} bold border />

          <p className="mt-4 mb-1 font-semibold uppercase tracking-wide">Expenses</p>
          {pl.expensesByCategory.length === 0 && (
            <p className="text-muted-foreground">No expenses recorded in this period.</p>
          )}
          {pl.expensesByCategory.map((e) => (
            <Line key={e.category} label={CATEGORY_LABEL(e.category)} value={-e.amount} capitalize />
          ))}
          <Line label="Total expenses" value={-pl.totalExpenses} bold border />

          <div
            className={`mt-4 flex justify-between border-t-2 pt-2 text-base font-bold ${
              isProfit ? "text-green-600 dark:text-green-500" : "text-destructive"
            }`}
          >
            <span>{isProfit ? "NET PROFIT" : "NET LOSS"}</span>
            <span>{formatPKR(Math.abs(pl.netProfit))}</span>
          </div>

          <div className="mt-4 flex justify-between border-t pt-2 text-xs text-muted-foreground">
            <span>Cash actually collected in this period (all bookings)</span>
            <span>{formatPKR(pl.cashCollected)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Line({
  label,
  value,
  bold,
  border,
  capitalize,
}: {
  label: string;
  value: number;
  bold?: boolean;
  border?: boolean;
  capitalize?: boolean;
}) {
  return (
    <div
      className={`flex justify-between ${bold ? "font-semibold" : ""} ${
        border ? "border-t pt-1" : ""
      }`}
    >
      <span className={`${bold ? "" : "text-muted-foreground"} ${capitalize ? "capitalize" : ""}`}>
        {label}
      </span>
      <span>
        {value < 0 ? `(${formatPKR(Math.abs(value))})` : formatPKR(value)}
      </span>
    </div>
  );
}
