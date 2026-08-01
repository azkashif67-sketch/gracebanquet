// Pure period-resolution helper — no DB/server dependency, safe to import
// anywhere. Resolves a URL-param period key into a [from, to] date range.
export type PeriodKey = "this_month" | "last_month" | "this_quarter" | "this_year" | "custom";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function resolvePeriod(
  period: string | undefined,
  customFrom?: string,
  customTo?: string,
): { from: string; to: string; label: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (period as PeriodKey) {
    case "last_month": {
      const from = new Date(year, month - 1, 1);
      const to = new Date(year, month, 0);
      return { from: toISODate(from), to: toISODate(to), label: "Last Month" };
    }
    case "this_quarter": {
      const qStartMonth = Math.floor(month / 3) * 3;
      const from = new Date(year, qStartMonth, 1);
      const to = new Date(year, qStartMonth + 3, 0);
      return { from: toISODate(from), to: toISODate(to), label: "This Quarter" };
    }
    case "this_year": {
      return { from: `${year}-01-01`, to: `${year}-12-31`, label: "This Year" };
    }
    case "custom": {
      return {
        from: customFrom ?? toISODate(new Date(year, month, 1)),
        to: customTo ?? toISODate(now),
        label: "Custom",
      };
    }
    case "this_month":
    default: {
      const from = new Date(year, month, 1);
      const to = new Date(year, month + 1, 0);
      return { from: toISODate(from), to: toISODate(to), label: "This Month" };
    }
  }
}
