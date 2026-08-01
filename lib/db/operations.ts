import "server-only";
import { and, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "./index";
import { bookings, counters, settings } from "./schema";
import type { Transaction } from "../calculations";

// ---------------------------------------------------------------------------
// 5.3 Invoice & Receipt numbering
// ---------------------------------------------------------------------------
async function getSetting(tx: Transaction, key: string): Promise<string | undefined> {
  const row = await tx.query.settings.findFirst({ where: eq(settings.key, key) });
  if (!row) return undefined;
  try {
    return JSON.parse(row.value) as string;
  } catch {
    return row.value;
  }
}

async function nextCounterValue(tx: Transaction, key: string): Promise<number> {
  // Atomic increment inside the caller's transaction.
  await tx
    .insert(counters)
    .values({ name: key, value: 1 })
    .onConflictDoUpdate({
      target: counters.name,
      set: { value: sql`${counters.value} + 1` },
    });
  const row = await tx.query.counters.findFirst({ where: eq(counters.name, key) });
  if (!row) throw new Error(`Counter "${key}" missing after upsert`);
  return row.value;
}

export async function nextInvoiceNo(tx: Transaction): Promise<string> {
  const year = new Date().getFullYear();
  const key = `invoice_${year}`;
  const prefix = (await getSetting(tx, "invoice_prefix")) ?? "INV";

  const value = await nextCounterValue(tx, key);
  return `${prefix}-${year}-${String(value).padStart(4, "0")}`;
}

export async function nextReceiptNo(tx: Transaction): Promise<string> {
  const year = new Date().getFullYear();
  const key = `receipt_${year}`;
  const prefix = (await getSetting(tx, "receipt_prefix")) ?? "RCP";

  const value = await nextCounterValue(tx, key);
  return `${prefix}-${year}-${String(value).padStart(4, "0")}`;
}

export async function nextQuoteNo(tx: Transaction): Promise<string> {
  const year = new Date().getFullYear();
  const key = `quote_${year}`;
  const prefix = (await getSetting(tx, "quote_prefix")) ?? "QTN";

  const value = await nextCounterValue(tx, key);
  return `${prefix}-${year}-${String(value).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// 5.4 Availability — the single most important query in the system.
// ---------------------------------------------------------------------------
export interface AvailabilityParams {
  eventDate: string;
  eventSlot: "day" | "night";
  hallSection: string;
  excludeBookingId?: string; // set when editing
}

export interface AvailabilityConflict {
  id: string;
  invoiceNo: string | null;
  clientName: string;
  status: string;
}

export interface AvailabilityResult {
  available: boolean;
  conflicts: AvailabilityConflict[];
}

function hallConflict(requested: string) {
  if (requested === "Full Venue") return undefined; // conflicts with all
  return or(
    eq(bookings.hallSection, requested),
    eq(bookings.hallSection, "Full Venue"),
  );
}

export async function checkAvailability(
  params: AvailabilityParams,
  handle: Transaction | typeof db = db,
): Promise<AvailabilityResult> {
  const conflicts = await handle
    .select({
      id: bookings.id,
      invoiceNo: bookings.invoiceNo,
      clientName: bookings.clientName,
      status: bookings.status,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.eventDate, params.eventDate),
        eq(bookings.eventSlot, params.eventSlot),
        inArray(bookings.status, ["confirmed", "tentative"]),
        isNull(bookings.deletedAt),
        params.excludeBookingId
          ? ne(bookings.id, params.excludeBookingId)
          : undefined,
        hallConflict(params.hallSection),
      ),
    );

  return { available: conflicts.length === 0, conflicts };
}
