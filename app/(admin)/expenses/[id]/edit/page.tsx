import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { getExpense, listBookingsForLinking } from "@/lib/db/queries/expenses";
import { toRupees } from "@/lib/calculations";
import { ExpenseForm } from "@/components/expenses/expense-form";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin", "manager");
  const { id } = await params;

  const [expense, bookings] = await Promise.all([getExpense(id), listBookingsForLinking()]);
  if (!expense) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Edit expense</h1>
      <ExpenseForm
        expenseId={expense.id}
        bookings={bookings}
        initial={{
          expenseDate: expense.expenseDate,
          category: expense.category as never,
          description: expense.description,
          amountRupees: toRupees(expense.amount),
          vendor: expense.vendor ?? undefined,
          method: expense.method ?? undefined,
          reference: expense.reference ?? undefined,
          bookingId: expense.bookingId ?? undefined,
          isRecurring: expense.isRecurring === 1,
        }}
      />
    </div>
  );
}
