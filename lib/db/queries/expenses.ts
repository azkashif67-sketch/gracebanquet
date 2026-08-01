import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../index";
import { bookings, expenses } from "../schema";

export async function listExpenses() {
  return db
    .select({
      id: expenses.id,
      expenseDate: expenses.expenseDate,
      category: expenses.category,
      description: expenses.description,
      amount: expenses.amount,
      vendor: expenses.vendor,
      bookingId: expenses.bookingId,
      bookingInvoiceNo: bookings.invoiceNo,
      isRecurring: expenses.isRecurring,
    })
    .from(expenses)
    .leftJoin(bookings, eq(bookings.id, expenses.bookingId))
    .where(isNull(expenses.deletedAt))
    .orderBy(desc(expenses.expenseDate));
}

export async function getExpense(id: string) {
  return db.query.expenses.findFirst({ where: and(eq(expenses.id, id), isNull(expenses.deletedAt)) });
}

// Lightweight list for the "link to booking" picker — recent, non-cancelled
// bookings only; this venue runs at a scale where that's plenty (spec's own
// sizing note: ~50 operations/day).
export async function listBookingsForLinking() {
  return db
    .select({ id: bookings.id, invoiceNo: bookings.invoiceNo, clientName: bookings.clientName })
    .from(bookings)
    .where(and(isNull(bookings.deletedAt)))
    .orderBy(desc(bookings.createdAt))
    .limit(100);
}
