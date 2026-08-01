import "server-only";
import { and, desc, gte, isNotNull, isNull, like, lte, ne, or } from "drizzle-orm";
import { db } from "../index";
import { bookings } from "../schema";

export type PaymentStatus = "paid" | "partial" | "unpaid" | "overdue";

export interface InvoiceRow {
  id: string;
  invoiceNo: string | null;
  createdAt: number;
  clientName: string;
  phone: string;
  eventDate: string;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  dueDate: string | null;
  paymentStatus: PaymentStatus;
}

function derivePaymentStatus(
  balanceDue: number,
  amountPaid: number,
  dueDate: string | null,
  today: string,
): PaymentStatus {
  if (balanceDue <= 0) return "paid";
  const isOverdue = Boolean(dueDate && dueDate < today);
  if (isOverdue) return "overdue";
  return amountPaid > 0 ? "partial" : "unpaid";
}

export interface InvoiceFilters {
  search?: string;
  paymentStatus?: PaymentStatus;
  eventDateFrom?: string;
  eventDateTo?: string;
}

export async function listInvoices(filters: InvoiceFilters = {}): Promise<InvoiceRow[]> {
  const today = new Date().toISOString().slice(0, 10);

  const rows = await db
    .select({
      id: bookings.id,
      invoiceNo: bookings.invoiceNo,
      createdAt: bookings.createdAt,
      clientName: bookings.clientName,
      phone: bookings.phone,
      eventDate: bookings.eventDate,
      grandTotal: bookings.grandTotal,
      amountPaid: bookings.amountPaid,
      balanceDue: bookings.balanceDue,
      dueDate: bookings.dueDate,
    })
    .from(bookings)
    .where(
      and(
        isNotNull(bookings.invoiceNo),
        ne(bookings.status, "cancelled"),
        isNull(bookings.deletedAt),
        filters.search
          ? or(
              like(bookings.invoiceNo, `%${filters.search}%`),
              like(bookings.clientName, `%${filters.search}%`),
              like(bookings.phone, `%${filters.search}%`),
            )
          : undefined,
        filters.eventDateFrom ? gte(bookings.eventDate, filters.eventDateFrom) : undefined,
        filters.eventDateTo ? lte(bookings.eventDate, filters.eventDateTo) : undefined,
      ),
    )
    .orderBy(desc(bookings.createdAt))
    .limit(300);

  const withStatus = rows.map((r) => ({
    ...r,
    paymentStatus: derivePaymentStatus(r.balanceDue, r.amountPaid, r.dueDate, today),
  }));

  return filters.paymentStatus
    ? withStatus.filter((r) => r.paymentStatus === filters.paymentStatus)
    : withStatus;
}
