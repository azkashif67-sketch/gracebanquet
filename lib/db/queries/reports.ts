import "server-only";
import { and, eq, gte, isNull, lte, ne } from "drizzle-orm";
import { db } from "../index";
import { bookingTaxes, bookings } from "../schema";

export interface RevenueFilters {
  from?: string;
  to?: string;
  eventType?: string;
  hallSection?: string;
}

export interface RevenueRow {
  id: string;
  invoiceNo: string | null;
  createdAt: number;
  eventDate: string;
  clientName: string;
  eventType: string;
  guestCount: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  hallSection: string;
  eventSlot: string;
}

// Revenue report (spec §13.1) — booking-based (attributed to when the event
// was booked isn't quite right for this venue's planning needs, so this
// filters/attributes by event date, the figure staff actually care about).
export async function getRevenueReport(filters: RevenueFilters = {}): Promise<RevenueRow[]> {
  return db
    .select({
      id: bookings.id,
      invoiceNo: bookings.invoiceNo,
      createdAt: bookings.createdAt,
      eventDate: bookings.eventDate,
      clientName: bookings.clientName,
      eventType: bookings.eventType,
      guestCount: bookings.guestCount,
      subtotal: bookings.subtotal,
      discountAmount: bookings.discountAmount,
      taxAmount: bookings.taxAmount,
      grandTotal: bookings.grandTotal,
      amountPaid: bookings.amountPaid,
      balanceDue: bookings.balanceDue,
      hallSection: bookings.hallSection,
      eventSlot: bookings.eventSlot,
    })
    .from(bookings)
    .where(
      and(
        ne(bookings.status, "cancelled"),
        isNull(bookings.deletedAt),
        filters.from ? gte(bookings.eventDate, filters.from) : undefined,
        filters.to ? lte(bookings.eventDate, filters.to) : undefined,
        filters.eventType ? eq(bookings.eventType, filters.eventType) : undefined,
        filters.hallSection ? eq(bookings.hallSection, filters.hallSection) : undefined,
      ),
    )
    .orderBy(bookings.eventDate);
}

export interface TaxReportRow {
  invoiceNo: string | null;
  createdAt: number;
  clientName: string;
  cnic: string | null;
  taxName: string;
  rate: number;
  taxableAmount: number;
  taxAmount: number;
  grandTotal: number;
}

// Tax report (spec §13.2) — one row per (invoice, tax) so a venue charging
// both sales tax and service charge files each correctly. Figures are on an
// invoice-issued basis (booking created_at), and read from booking_taxes'
// snapshot, never the live taxes table, so a later rate change can't alter
// what a past return said.
export async function getTaxReport(from?: string, to?: string): Promise<TaxReportRow[]> {
  const fromTs = from ? Math.floor(new Date(from).getTime() / 1000) : undefined;
  const toTs = to ? Math.floor(new Date(to).getTime() / 1000) + 86400 : undefined;

  const rows = await db
    .select({
      invoiceNo: bookings.invoiceNo,
      createdAt: bookings.createdAt,
      clientName: bookings.clientName,
      cnic: bookings.cnic,
      taxableAmount: bookings.taxableAmount,
      grandTotal: bookings.grandTotal,
      taxName: bookingTaxes.taxName,
      rate: bookingTaxes.rate,
      taxAmount: bookingTaxes.taxAmount,
    })
    .from(bookingTaxes)
    .innerJoin(bookings, eq(bookings.id, bookingTaxes.bookingId))
    .where(
      and(
        ne(bookings.status, "cancelled"),
        isNull(bookings.deletedAt),
        fromTs ? gte(bookings.createdAt, fromTs) : undefined,
        toTs ? lte(bookings.createdAt, toTs) : undefined,
      ),
    )
    .orderBy(bookings.createdAt);

  return rows;
}

// Forfeited advances on cancelled bookings are other income, not part of the
// tax report's taxable value, but still worth surfacing per spec §13.2's
// footnote ("Forfeited advances shown separately as other income").
export async function getForfeitedAdvances(from?: string, to?: string) {
  const fromTs = from ? Math.floor(new Date(from).getTime() / 1000) : undefined;
  const toTs = to ? Math.floor(new Date(to).getTime() / 1000) + 86400 : undefined;

  return db
    .select({
      invoiceNo: bookings.invoiceNo,
      clientName: bookings.clientName,
      cancelledAt: bookings.cancelledAt,
      refundAmount: bookings.refundAmount,
      amountPaid: bookings.amountPaid,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.status, "cancelled"),
        eq(bookings.advanceHandling, "forfeit"),
        isNull(bookings.deletedAt),
        fromTs ? gte(bookings.cancelledAt, fromTs) : undefined,
        toTs ? lte(bookings.cancelledAt, toTs) : undefined,
      ),
    );
}

