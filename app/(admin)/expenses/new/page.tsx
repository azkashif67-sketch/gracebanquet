import { requireRole } from "@/lib/auth/require-role";
import { listBookingsForLinking } from "@/lib/db/queries/expenses";
import { ExpenseForm } from "@/components/expenses/expense-form";

export default async function NewExpensePage() {
  await requireRole("admin", "manager");
  const bookings = await listBookingsForLinking();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Add expense</h1>
      <ExpenseForm bookings={bookings} />
    </div>
  );
}
