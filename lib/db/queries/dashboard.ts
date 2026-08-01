import "server-only";
import { and, desc, eq, gte, inArray, isNull, lte, ne } from "drizzle-orm";
import { db } from "../index";
import { auditLog, bookings, expenses, payments, users } from "../schema";

export interface Kpis {
  bookingsCount: number;
  cashCollected: number;
  outstanding: number;
  expensesTotal: number;
}

export async function getKpis(from: string, to: string): Promise<Kpis> {
  const fromTs = Math.floor(new Date(from).getTime() / 1000);
  const toTs = Math.floor(new Date(to).getTime() / 1000) + 86400 - 1;

  const [bookingsRows, paymentRows, outstandingRows, expenseRows] = await Promise.all([
    db
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(
          gte(bookings.createdAt, fromTs),
          lte(bookings.createdAt, toTs),
          ne(bookings.status, "cancelled"),
          isNull(bookings.deletedAt),
        ),
      ),
    db
      .select({ amount: payments.amount })
      .from(payments)
      .where(and(gte(payments.paidOn, from), lte(payments.paidOn, to), isNull(payments.deletedAt))),
    db
      .select({ balanceDue: bookings.balanceDue })
      .from(bookings)
      .where(and(inArray(bookings.status, ["confirmed", "tentative"]), isNull(bookings.deletedAt))),
    db
      .select({ amount: expenses.amount })
      .from(expenses)
      .where(and(gte(expenses.expenseDate, from), lte(expenses.expenseDate, to), isNull(expenses.deletedAt))),
  ]);

  return {
    bookingsCount: bookingsRows.length,
    cashCollected: paymentRows.reduce((s, p) => s + p.amount, 0),
    outstanding: outstandingRows.reduce((s, b) => s + Math.max(0, b.balanceDue), 0),
    expensesTotal: expenseRows.reduce((s, e) => s + e.amount, 0),
  };
}

export async function getLatestBookings(limit = 5) {
  return db
    .select({
      id: bookings.id,
      invoiceNo: bookings.invoiceNo,
      clientName: bookings.clientName,
      eventDate: bookings.eventDate,
      eventSlot: bookings.eventSlot,
      grandTotal: bookings.grandTotal,
      status: bookings.status,
    })
    .from(bookings)
    .where(isNull(bookings.deletedAt))
    .orderBy(desc(bookings.createdAt))
    .limit(limit);
}

export async function getBalancesDueThisWeek() {
  const today = new Date().toISOString().slice(0, 10);
  const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  return db
    .select({
      id: bookings.id,
      clientName: bookings.clientName,
      phone: bookings.phone,
      eventDate: bookings.eventDate,
      balanceDue: bookings.balanceDue,
      dueDate: bookings.dueDate,
    })
    .from(bookings)
    .where(
      and(
        inArray(bookings.status, ["confirmed", "tentative"]),
        isNull(bookings.deletedAt),
        gte(bookings.dueDate, today),
        lte(bookings.dueDate, in7Days),
      ),
    )
    .orderBy(bookings.dueDate);
}

export interface ActivityRow {
  id: string;
  summary: string;
  actorName: string;
  createdAt: number;
}

export async function getRecentActivity(limit = 8): Promise<ActivityRow[]> {
  const rows = await db
    .select({
      id: auditLog.id,
      summary: auditLog.summary,
      createdAt: auditLog.createdAt,
      actorName: users.fullName,
    })
    .from(auditLog)
    .innerJoin(users, eq(users.id, auditLog.userId))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
  return rows;
}
