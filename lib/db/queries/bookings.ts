import "server-only";
import { and, count, desc, eq, gte, isNull, lte, ne } from "drizzle-orm";
import { db } from "../index";
import {
  bookingExtras,
  bookingMenu,
  bookingServices,
  bookingTaxes,
  bookings,
  payments,
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

export async function getBookingDetail(id: string) {
  const booking = await db.query.bookings.findFirst({ where: eq(bookings.id, id) });
  if (!booking) return null;

  const [serviceLines, menu, extras, taxLines, paymentRows] = await Promise.all([
    db.select().from(bookingServices).where(eq(bookingServices.bookingId, id)).orderBy(bookingServices.sortOrder),
    db.select().from(bookingMenu).where(eq(bookingMenu.bookingId, id)),
    db.select().from(bookingExtras).where(eq(bookingExtras.bookingId, id)),
    db.select().from(bookingTaxes).where(eq(bookingTaxes.bookingId, id)),
    db.select().from(payments).where(and(eq(payments.bookingId, id), isNull(payments.deletedAt))),
  ]);

  return { booking, serviceLines, menu, extras, taxLines, payments: paymentRows };
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
