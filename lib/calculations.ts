// Pure, client-safe money/totals logic — no runtime dependency on the DB
// client. DB-touching operations (availability checks, invoice/receipt
// numbering) live in ./db/operations.ts (server-only) so this module can be
// imported from client components (e.g. the booking wizard's live totals
// panel) without pulling @libsql/client into the browser bundle.
import type { db as DbInstance } from "./db";

// A transaction handle has the same query-builder surface as `db` itself;
// derive its type (type-only import — erased at compile time) so server-only
// callers can pass either.
export type Transaction = Parameters<
  Parameters<typeof DbInstance["transaction"]>[0]
>[0];

// ---------------------------------------------------------------------------
// 5.1 Money handling — all amounts are integers in paisa. 1 rupee = 100 paisa.
// ---------------------------------------------------------------------------
export const toPaisa = (rupees: number): number => Math.round(rupees * 100);
export const toRupees = (paisa: number): number => paisa / 100;

export const formatPKR = (paisa: number): string =>
  "Rs " +
  (paisa / 100).toLocaleString("en-PK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

// ---------------------------------------------------------------------------
// 5.2 Booking totals
// ---------------------------------------------------------------------------
export interface TotalsLine {
  qty: number;
  rate: number;
  taxable: boolean;
}

export interface TaxInput {
  id: string;
  name: string;
  rateBps: number;
}

export interface TotalsInput {
  serviceLines: TotalsLine[];
  extraLines: TotalsLine[];
  discountAmount: number;
  taxes: TaxInput[]; // the taxes applied to this booking
  taxOnDiscounted: boolean; // from settings
}

export interface TaxLine {
  id: string;
  name: string;
  rateBps: number;
  amount: number;
}

export interface TotalsResult {
  subtotal: number;
  discount: number;
  taxableAmount: number;
  taxLines: TaxLine[];
  taxAmount: number;
  grandTotal: number;
}

export function calculateTotals(input: TotalsInput): TotalsResult {
  const lineTotal = (l: { qty: number; rate: number }) => l.qty * l.rate;

  const subtotal =
    input.serviceLines.reduce((s, l) => s + lineTotal(l), 0) +
    input.extraLines.reduce((s, l) => s + lineTotal(l), 0);

  const discount = Math.min(input.discountAmount, subtotal);

  // Base on which tax is charged
  const taxableBase = input.taxOnDiscounted ? subtotal - discount : subtotal;

  // Only taxable lines contribute; compute their proportion of the base
  const taxableLineSum =
    input.serviceLines
      .filter((l) => l.taxable)
      .reduce((s, l) => s + lineTotal(l), 0) +
    input.extraLines
      .filter((l) => l.taxable)
      .reduce((s, l) => s + lineTotal(l), 0);

  const taxableProportion = subtotal === 0 ? 0 : taxableLineSum / subtotal;
  const taxableAmount = Math.round(taxableBase * taxableProportion);

  // Each applicable tax is computed on the same taxable amount, then summed.
  // Additive, never compounding — that's what keeps two taxes correct.
  const taxLines: TaxLine[] = input.taxes.map((t) => ({
    id: t.id,
    name: t.name,
    rateBps: t.rateBps,
    amount: Math.round((taxableAmount * t.rateBps) / 10000),
  }));
  const taxAmount = taxLines.reduce((s, t) => s + t.amount, 0);

  const grandTotal = subtotal - discount + taxAmount;

  return { subtotal, discount, taxableAmount, taxLines, taxAmount, grandTotal };
}
