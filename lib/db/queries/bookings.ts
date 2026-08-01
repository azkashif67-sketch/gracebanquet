import "server-only";
import { and, count, desc, eq, gt, gte, inArray, isNull, lt, lte, ne, sql } from "drizzle-orm";
import { db } from "../index";
import {
  bookingExtras,
  bookingMenu,
  bookingServices,
  bookingTaxes,
  bookings,
  installments,
  payments,
  users,
} from "../schema";

export async function findClientByPhone(phone: string) {
  if (!phone) return null;
  const rows = await db
    .select({
      clientName: bookings.clientName,
      cnic: bookings.cnic,
      address: bookings.address,
      altPhone: bookings.altPhone,
    })
    .from(bookings)
    .where(and(eq(bookings.phone, phone), isNull(bookings.deletedAt)))
    .orderBy(desc(bookings.createdAt))
    .limit(1);

  if (rows.length === 0) return null;

  const countRow = await db
    .select({ n: count() })
    .from(bookings)
    .where(and(eq(bookings.phone, phone), isNull(bookings.deletedAt)));

  return { ...rows[0], previousCount: countRow[0]?.n ?? 0 };
}

export async function listBookings() {
  return db
    .select({
      id: bookings.id,
      invoiceNo: bookings.invoiceNo,
      clientName: bookings.clientName,
      phone: bookings.phone,
      eventDate: bookings.eventDate,
      eventSlot: bookings.eventSlot,
      eventType: bookings.eventType,
      hallSection: bookings.hallSection,
      guestCount: bookings.guestCount,
      grandTotal: bookings.grandTotal,
      amountPaid: bookings.amountPaid,
      balanceDue: bookings.balanceDue,
      status: bookings.status,
    })
    .from(bookings)
    .where(isNull(bookings.deletedAt))
    .orderBy(desc(bookings.createdAt))
    .limit(200);
}

export interface InstallmentWithStatus {
  id: string;
  label: string;
  amount: number;
  dueDate: string;
  paidAmount: number;
  status: "paid" | "partial" | "pending" | "overdue";
}

export async function getBookingDetail(id: string) {
  const booking = await db.query.bookings.findFirst({ where: eq(bookings.id, id) });
  if (!booking) return null;

  const [serviceLines, menu, extras, taxLines, paymentRows, installmentRows] = await Promise.all([
    db.select().from(bookingServices).where(eq(bookingServices.bookingId, id)).orderBy(bookingServices.sortOrder),
    db.select().from(bookingMenu).where(eq(bookingMenu.bookingId, id)),
    db.select().from(bookingExtras).where(eq(bookingExtras.bookingId, id)),
    db.select().from(bookingTaxes).where(eq(bookingTaxes.bookingId, id)),
    db.select().from(payments).where(and(eq(payments.bookingId, id), isNull(payments.deletedAt))),
    db.select().from(installments).where(eq(installments.bookingId, id)).orderBy(installments.sortOrder),
  ]);

  // Status is derived, not stored — compare each step's planned amount
  // against the payments actually tagged to it (spec §9.1 Step 4).
  const today = new Date().toISOString().slice(0, 10);
  const installmentsWithStatus: InstallmentWithStatus[] = installmentRows.map((inst) => {
    const paidAmount = paymentRows
      .filter((p) => p.installmentId === inst.id)
      .reduce((sum, p) => sum + p.amount, 0);

    let status: InstallmentWithStatus["status"];
    if (paidAmount >= inst.amount) status = "paid";
    else if (paidAmount > 0) status = "partial";
    else if (inst.dueDate < today) status = "overdue";
    else status = "pending";

    return { id: inst.id, label: inst.label, amount: inst.amount, dueDate: inst.dueDate, paidAmount, status };
  });

  return {
    booking,
    serviceLines,
    menu,
    extras,
    taxLines,
    payments: paymentRows,
    installments: installmentsWithStatus,
  };
}

// The running balance immediately after this payment was recorded, by
// insertion order — the figure a receipt prints as "balance remaining".
export async function getPaymentReceiptData(bookingId: string, paymentId: string) {
  const booking = await db.query.bookings.findFirst({ where: eq(bookings.id, bookingId) });
  if (!booking) return null;

  const payment = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
  if (!payment || payment.bookingId !== bookingId) return null;

  const recordedByUser = await db.query.users.findFirst({ where: eq(users.id, payment.recordedBy) });

  const [{ total: cumulativePaid }] = await db
    .select({ total: sql<number>`COALESCE(SUM(${payments.amount}), 0)` })
    .from(payments)
    .where(
      and(
        eq(payments.bookingId, bookingId),
        isNull(payments.deletedAt),
        lte(payments.createdAt, payment.createdAt),
      ),
    );

  return {
    booking,
    payment,
    recordedByName: recordedByUser?.fullName ?? "—",
    balanceAfter: booking.grandTotal - cumulativePaid,
  };
}

// Dues detection (spec §5.5) — computed on render, not by a cron, so it can
// never go stale from a silently-dead scheduled job.
export interface DuesBooking {
  id: string;
  invoiceNo: string | null;
  clientName: string;
  phone: string;
  eventDate: string;
  balanceDue: number;
  dueDate: string | null;
}

export async function getDuesAlerts() {
  const today = new Date().toISOString().slice(0, 10);
  const in3Days = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10);

  const cols = {
    id: bookings.id,
    invoiceNo: bookings.invoiceNo,
    clientName: bookings.clientName,
    phone: bookings.phone,
    eventDate: bookings.eventDate,
    balanceDue: bookings.balanceDue,
    dueDate: bookings.dueDate,
  };

  const open = and(
    inArray(bookings.status, ["confirmed", "tentative"]),
    gt(bookings.balanceDue, 0),
    isNull(bookings.deletedAt),
  );

  const [overdue, dueSoon, eventTomorrow, expiringHolds] = await Promise.all([
    db.select(cols).from(bookings).where(and(open, lt(bookings.dueDate, today))),
    db
      .select(cols)
      .from(bookings)
      .where(and(open, gte(bookings.dueDate, today), lte(bookings.dueDate, in3Days))),
    db.select(cols).from(bookings).where(and(open, eq(bookings.eventDate, tomorrow))),
    db
      .select(cols)
      .from(bookings)
      .where(
        and(
          eq(bookings.status, "tentative"),
          lte(bookings.holdExpiresOn, in3Days),
          isNull(bookings.deletedAt),
        ),
      ),
  ]);

  return { overdue, dueSoon, eventTomorrow, expiringHolds };
}

export interface ReceivableRow extends DuesBooking {
  daysOverdue: number;
  bucket: "not_yet_due" | "1_7" | "8_30" | "30_plus";
}

// Ages every open balance into buckets. For bookings using an installment
// plan (no single `due_date`), the earliest unpaid step's due date stands in
// — the plan replaces the single date but not the need to know what's late.
export async function getReceivablesAged(): Promise<ReceivableRow[]> {
  const rows = await db
    .select({
      id: bookings.id,
      invoiceNo: bookings.invoiceNo,
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
        gt(bookings.balanceDue, 0),
        isNull(bookings.deletedAt),
      ),
    );

  const bookingIdsWithoutDueDate = rows.filter((r) => !r.dueDate).map((r) => r.id);
  const earliestUnpaidByBooking = new Map<string, string>();
  if (bookingIdsWithoutDueDate.length > 0) {
    const instRows = await db
      .select({ bookingId: installments.bookingId, dueDate: installments.dueDate, id: installments.id })
      .from(installments)
      .where(inArray(installments.bookingId, bookingIdsWithoutDueDate))
      .orderBy(installments.dueDate);
    // First row per booking (already ordered ascending) is the earliest step.
    for (const r of instRows) {
      if (!earliestUnpaidByBooking.has(r.bookingId)) earliestUnpaidByBooking.set(r.bookingId, r.dueDate);
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return rows.map((r) => {
    const effectiveDueDate = r.dueDate ?? earliestUnpaidByBooking.get(r.id) ?? null;
    let daysOverdue = 0;
    let bucket: ReceivableRow["bucket"] = "not_yet_due";
    if (effectiveDueDate) {
      const due = new Date(effectiveDueDate);
      daysOverdue = Math.floor((today.getTime() - due.getTime()) / 86400000);
      if (daysOverdue <= 0) bucket = "not_yet_due";
      else if (daysOverdue <= 7) bucket = "1_7";
      else if (daysOverdue <= 30) bucket = "8_30";
      else bucket = "30_plus";
    }
    return { ...r, dueDate: effectiveDueDate, daysOverdue, bucket };
  });
}

export interface MonthBooking {
  id: string;
  invoiceNo: string | null;
  clientName: string;
  eventDate: string;
  eventSlot: string;
  hallSection: string;
  guestCount: number;
  status: string;
  balanceDue: number;
  phone: string;
}

export async function listBookingsInRange(
  startDate: string,
  endDate: string,
  hallSection?: string,
): Promise<MonthBooking[]> {
  return db
    .select({
      id: bookings.id,
      invoiceNo: bookings.invoiceNo,
      clientName: bookings.clientName,
      eventDate: bookings.eventDate,
      eventSlot: bookings.eventSlot,
      hallSection: bookings.hallSection,
      guestCount: bookings.guestCount,
      status: bookings.status,
      balanceDue: bookings.balanceDue,
      phone: bookings.phone,
    })
    .from(bookings)
    .where(
      and(
        gte(bookings.eventDate, startDate),
        lte(bookings.eventDate, endDate),
        ne(bookings.status, "cancelled"),
        isNull(bookings.deletedAt),
        hallSection ? eq(bookings.hallSection, hallSection) : undefined,
      ),
    );
}
