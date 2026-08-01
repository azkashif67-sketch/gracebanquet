import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { listExpenses } from "@/lib/db/queries/expenses";
import { formatPKR } from "@/lib/calculations";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteExpenseButton } from "@/components/expenses/delete-expense-button";

export default async function ExpensesPage() {
  await requireRole("admin", "manager");
  const rows = await listExpenses();
  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Expenses</h1>
        <Button render={<Link href="/expenses/new">Add expense</Link>} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Linked Booking</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{r.expenseDate}</TableCell>
              <TableCell className="capitalize">{r.category.replace("_", " ")}</TableCell>
              <TableCell>{r.description}</TableCell>
              <TableCell>{r.vendor ?? "—"}</TableCell>
              <TableCell>{formatPKR(r.amount)}</TableCell>
              <TableCell>
                {r.bookingId ? (
                  <Link href={`/bookings/${r.bookingId}`} className="text-primary hover:underline">
                    {r.bookingInvoiceNo ?? "(draft)"}
                  </Link>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="flex justify-end gap-2">
                <Button variant="outline" size="sm" render={<Link href={`/expenses/${r.id}/edit`}>Edit</Link>} />
                <DeleteExpenseButton id={r.id} description={r.description} />
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                No expenses recorded yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <p className="text-sm text-muted-foreground">
        Showing {rows.length} expense{rows.length === 1 ? "" : "s"} · Total {formatPKR(total)}
      </p>
    </div>
  );
}
