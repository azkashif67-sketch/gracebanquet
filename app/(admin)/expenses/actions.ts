"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/lib/db";
import { expenses } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/require-role";
import { audit, diff } from "@/lib/audit";

const CATEGORIES = [
  "salaries",
  "utilities",
  "food_raw",
  "decor_material",
  "maintenance",
  "rent",
  "fuel",
  "transport",
  "marketing",
  "equipment",
  "taxes_fees",
  "misc",
] as const;

const expenseSchema = z.object({
  expenseDate: z.string().min(1),
  category: z.enum(CATEGORIES),
  description: z.string().min(1),
  amountPaisa: z.number().int().positive(),
  vendor: z.string().optional(),
  method: z.string().optional(),
  reference: z.string().optional(),
  bookingId: z.string().optional(),
  isRecurring: z.boolean(),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;

export interface ActionResult {
  error?: string;
}

export async function createExpense(input: ExpenseInput): Promise<ActionResult> {
  const user = await requireRole("admin", "manager");
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const data = parsed.data;

  const id = nanoid();
  await db.transaction(async (tx) => {
    await tx.insert(expenses).values({
      id,
      expenseDate: data.expenseDate,
      category: data.category,
      description: data.description,
      amount: data.amountPaisa,
      vendor: data.vendor || null,
      method: data.method || null,
      reference: data.reference || null,
      bookingId: data.bookingId || null,
      isRecurring: data.isRecurring ? 1 : 0,
      paidBy: user.id,
      createdAt: Math.floor(Date.now() / 1000),
    });
    await audit(tx, {
      userId: user.id,
      action: "create",
      module: "expense",
      recordId: id,
      summary: `Recorded expense "${data.description}" (${data.category})`,
    });
  });

  revalidatePath("/expenses");
  redirect("/expenses");
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<ActionResult> {
  const user = await requireRole("admin", "manager");
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const data = parsed.data;

  const before = await db.query.expenses.findFirst({ where: eq(expenses.id, id) });
  if (!before) return { error: "Expense not found." };

  await db.transaction(async (tx) => {
    await tx
      .update(expenses)
      .set({
        expenseDate: data.expenseDate,
        category: data.category,
        description: data.description,
        amount: data.amountPaisa,
        vendor: data.vendor || null,
        method: data.method || null,
        reference: data.reference || null,
        bookingId: data.bookingId || null,
        isRecurring: data.isRecurring ? 1 : 0,
      })
      .where(eq(expenses.id, id));

    await audit(tx, {
      userId: user.id,
      action: "update",
      module: "expense",
      recordId: id,
      summary: `Updated expense "${data.description}"`,
      changes: diff(
        { description: before.description, amount: before.amount, category: before.category },
        { description: data.description, amount: data.amountPaisa, category: data.category },
      ),
    });
  });

  revalidatePath("/expenses");
  redirect("/expenses");
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  const user = await requireRole("admin", "manager");
  const before = await db.query.expenses.findFirst({ where: eq(expenses.id, id) });
  if (!before) return { error: "Expense not found." };

  await db.transaction(async (tx) => {
    await tx.update(expenses).set({ deletedAt: Math.floor(Date.now() / 1000) }).where(eq(expenses.id, id));
    await audit(tx, {
      userId: user.id,
      action: "delete",
      module: "expense",
      recordId: id,
      summary: `Deleted expense "${before.description}"`,
    });
  });

  revalidatePath("/expenses");
  return {};
}
