import "server-only";
import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "../index";
import { bookings, payments } from "../schema";

export interface ClientDirectoryRow {
  phone: string;
  clientName: string;
  bookingCount: number;
  lifetimeValue: number;
  lastEvent: string;
  outstanding: number;
}

// Client Management has no dedicated table — phone number is the key,
// derived from bookings (spec §13.6). No "create client" step.
export async function listClients(): Promise<ClientDirectoryRow[]> {
  const rows = await db
    .select({
      phone: bookings.phone,
      clientName: sql<string>`MAX(${bookings.clientName})`,
      bookingCount: sql<number>`COUNT(*)`,
      lifetimeValue: sql<number>`SUM(${bookings.grandTotal})`,
      lastEvent: sql<string>`MAX(${bookings.eventDate})`,
      outstanding: sql<number>`SUM(${bookings.balanceDue})`,
    })
    .from(bookings)
    .where(and(ne(bookings.status, "cancelled"), isNull(bookings.deletedAt)))
    .groupBy(bookings.phone)
    .orderBy(desc(sql`MAX(${bookings.eventDate})`));

  return rows;
}

export interface ClientDetail {
  phone: string;
  clientName: string;
  altPhone: string | null;
  cnic: string | null;
  address: string | null;
  bookingCount: number;
  lifetimeValue: number;
  averageBookingValue: number;
  totalOutstanding: number;
  cancellationCount: number;
  averageDaysLate: number | null;
  isLatePayer: boolean;
  bookings: {
    id: string;
    invoiceNo: string | null;
    eventDate: string;
    eventType: string;
    grandTotal: number;
    balanceDue: number;
    status: string;
  }[];
}

const LATE_PAYER_THRESHOLD_DAYS = 7;

export async function getClientDetail(phone: string): Promise<ClientDetail | null> {
  const allBookings = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.phone, phone), isNull(bookings.deletedAt)))
    .orderBy(desc(bookings.eventDate));

  if (allBookings.length === 0) return null;

  const active = allBookings.filter((b) => b.status !== "cancelled");
  const mostRecent = allBookings[0];

  const lifetimeValue = active.reduce((s, b) => s + b.grandTotal, 0);
  const totalOutstanding = active.reduce((s, b) => s + b.balanceDue, 0);
  const cancellationCount = allBookings.filter((b) => b.status === "cancelled").length;

  // Average days late: for fully-settled bookings with a due date, compare
  // the due date to the date their balance actually reached zero (the last
  // payment's date).
  const settledWithDueDate = active.filter((b) => b.balanceDue <= 0 && b.dueDate);
  let averageDaysLate: number | null = null;
  if (settledWithDueDate.length > 0) {
    // One query for every relevant booking's payments, instead of one query
    // per booking — the latter turned viewing a client with a long history
    // into dozens of sequential round-trips to the database.
    const allPayments = await db
      .select({ bookingId: payments.bookingId, paidOn: payments.paidOn })
      .from(payments)
      .where(
        and(
          inArray(payments.bookingId, settledWithDueDate.map((b) => b.id)),
          isNull(payments.deletedAt),
        ),
      );

    const latestPaidOnByBooking = new Map<string, string>();
    for (const p of allPayments) {
      const current = latestPaidOnByBooking.get(p.bookingId);
      if (!current || p.paidOn > current) latestPaidOnByBooking.set(p.bookingId, p.paidOn);
    }

    const lateDays: number[] = [];
    for (const b of settledWithDueDate) {
      const paidOn = latestPaidOnByBooking.get(b.id);
      if (paidOn && b.dueDate) {
        const days = Math.floor(
          (new Date(paidOn).getTime() - new Date(b.dueDate).getTime()) / 86400000,
        );
        lateDays.push(Math.max(0, days));
      }
    }
    if (lateDays.length > 0) {
      averageDaysLate = Math.round(lateDays.reduce((s, d) => s + d, 0) / lateDays.length);
    }
  }

  return {
    phone,
    clientName: mostRecent.clientName,
    altPhone: mostRecent.altPhone,
    cnic: mostRecent.cnic,
    address: mostRecent.address,
    bookingCount: active.length,
    lifetimeValue,
    averageBookingValue: active.length > 0 ? Math.round(lifetimeValue / active.length) : 0,
    totalOutstanding,
    cancellationCount,
    averageDaysLate,
    isLatePayer: averageDaysLate !== null && averageDaysLate > LATE_PAYER_THRESHOLD_DAYS,
    bookings: allBookings.map((b) => ({
      id: b.id,
      invoiceNo: b.invoiceNo,
      eventDate: b.eventDate,
      eventType: b.eventType,
      grandTotal: b.grandTotal,
      balanceDue: b.balanceDue,
      status: b.status,
    })),
  };
}
