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
}

export interface TaxInput {
  id: string;
  name: string;
  rateBps: number;
}

export interface TotalsInput {
  hallRent: number; // paisa — the ONLY tax base
  serviceLines: TotalsLine[];
  extraLines: TotalsLine[];
  discountAmount: number;
  taxes: TaxInput[]; // the taxes applied to this booking
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
  /** The base tax is computed on — always the hall rent. */
  taxableAmount: number;
  taxLines: TaxLine[];
  /** Informational only. Already inside grandTotal; never added to it. */
  taxAmount: number;
  grandTotal: number;
  /** What the venue actually keeps once the tax is handed over. */
  netOfTax: number;
}

/**
 * Sales tax here is INCLUSIVE and INTERNAL:
 *
 *   - It applies only to the hall rent — never to catering, decor, sound, or
 *     any extra. Those lines are not taxed at all.
 *   - It is NOT added to what the customer pays. The rent is quoted
 *     tax-inclusive, so `grandTotal` is just `subtotal - discount`. The tax
 *     figure exists so the venue knows what it owes; the customer's document
 *     only ever says "inclusive of applicable sales tax".
 *   - A discount does not shrink the tax base. Tax is 16% of the rent as
 *     charged, per the venue's filing practice.
 *
 * Multiple taxes stay additive on the same base (never compounding), and each
 * is snapshotted into `booking_taxes` at save time so changing a rate later
 * can never rewrite an issued document.
 */
export function calculateTotals(input: TotalsInput): TotalsResult {
  const lineTotal = (l: TotalsLine) => l.qty * l.rate;

  const hallRent = Math.max(0, input.hallRent);

  const subtotal =
    hallRent +
    input.serviceLines.reduce((s, l) => s + lineTotal(l), 0) +
    input.extraLines.reduce((s, l) => s + lineTotal(l), 0);

  const discount = Math.min(input.discountAmount, subtotal);

  // Hall rent is the entire tax base — undiscounted.
  const taxableAmount = hallRent;

  const taxLines: TaxLine[] = input.taxes.map((t) => ({
    id: t.id,
    name: t.name,
    rateBps: t.rateBps,
    amount: Math.round((taxableAmount * t.rateBps) / 10000),
  }));
  const taxAmount = taxLines.reduce((s, t) => s + t.amount, 0);

  // Tax is already inside the rent, so it is deliberately absent here.
  const grandTotal = subtotal - discount;
  const netOfTax = grandTotal - taxAmount;

  return { subtotal, discount, taxableAmount, taxLines, taxAmount, grandTotal, netOfTax };
}

// ---------------------------------------------------------------------------
// Amount in words — Pakistani receipts use the lakh/crore convention, not
// million/billion (spec §9.8, §20.12): "Rs 957,000" is "Nine Lakh Fifty-Seven
// Thousand Rupees Only", not "Nine Hundred Fifty-Seven Thousand".
// ---------------------------------------------------------------------------
const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowHundredToWords(n: number): string {
  if (n < 20) return ONES[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return TENS[tens] + (ones ? `-${ONES[ones]}` : "");
}

function belowThousandToWords(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest) parts.push(belowHundredToWords(rest));
  return parts.join(" ");
}

// Converts a non-negative integer into words using the lakh/crore grouping.
export function numberToWords(n: number): string {
  const value = Math.floor(Math.abs(n));
  if (value === 0) return "Zero";

  const crore = Math.floor(value / 1_00_00_000);
  const lakh = Math.floor((value % 1_00_00_000) / 1_00_000);
  const thousand = Math.floor((value % 1_00_000) / 1_000);
  const remainder = value % 1_000;

  const parts: string[] = [];
  if (crore) parts.push(`${belowThousandToWords(crore)} Crore`);
  if (lakh) parts.push(`${belowThousandToWords(lakh)} Lakh`);
  if (thousand) parts.push(`${belowThousandToWords(thousand)} Thousand`);
  if (remainder) parts.push(belowThousandToWords(remainder));

  return parts.join(" ");
}

// Formats a paisa amount as the words printed on a receipt, e.g.
// "Nine Lakh Fifty-Seven Thousand Rupees Only" or, with a paisa remainder,
// "One Thousand Rupees and Fifty Paisa Only".
export function amountInWords(paisa: number): string {
  const rupees = Math.floor(Math.abs(paisa) / 100);
  const paisaRemainder = Math.abs(paisa) % 100;

  const rupeeWords = `${numberToWords(rupees)} Rupee${rupees === 1 ? "" : "s"}`;
  const paisaWords = paisaRemainder > 0 ? ` and ${numberToWords(paisaRemainder)} Paisa` : "";

  return `${rupeeWords}${paisaWords} Only`;
}
