"use server";

import { revalidatePath } from "next/cache";
import { count, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/lib/db";
import { bookingTaxes, taxes } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/require-role";
import { audit, diff } from "@/lib/audit";

const taxSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["sales_tax", "service_charge", "other"]),
  ratePercent: z.number().min(0).max(100),
  isDefault: z.boolean(),
  active: z.boolean(),
});

export type TaxInput = z.infer<typeof taxSchema>;

export interface ActionResult {
  error?: string;
}

export async function createTax(input: TaxInput): Promise<ActionResult> {
  const user = await requireRole("admin");
  const parsed = taxSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const data = parsed.data;

  const id = nanoid();
  await db.transaction(async (tx) => {
    await tx.insert(taxes).values({
      id,
      name: data.name,
      type: data.type,
      rate: Math.round(data.ratePercent * 100),
      active: data.active ? 1 : 0,
      isDefault: data.isDefault ? 1 : 0,
      sortOrder: 0,
      createdAt: Math.floor(Date.now() / 1000),
    });
    await audit(tx, {
      userId: user.id,
      action: "create",
      module: "tax",
      recordId: id,
      summary: `Created tax "${data.name}" (${data.ratePercent}%)`,
    });
  });

  revalidatePath("/taxes");
  return {};
}

export async function updateTax(id: string, input: TaxInput): Promise<ActionResult> {
  const user = await requireRole("admin");
  const parsed = taxSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const data = parsed.data;

  const before = await db.query.taxes.findFirst({ where: eq(taxes.id, id) });
  if (!before) return { error: "Tax not found." };

  const after = {
    name: data.name,
    type: data.type,
    rate: Math.round(data.ratePercent * 100),
    active: data.active ? 1 : 0,
    isDefault: data.isDefault ? 1 : 0,
  };

  await db.transaction(async (tx) => {
    await tx.update(taxes).set(after).where(eq(taxes.id, id));
    await audit(tx, {
      userId: user.id,
      action: "update",
      module: "tax",
      recordId: id,
      summary: `Updated tax "${data.name}"`,
      changes: diff(
        { name: before.name, type: before.type, rate: before.rate, active: before.active, isDefault: before.isDefault },
        after,
      ),
    });
  });

  revalidatePath("/taxes");
  return {};
}

export async function deleteOrDeactivateTax(
  id: string,
): Promise<ActionResult & { deactivated?: boolean }> {
  const user = await requireRole("admin");

  const before = await db.query.taxes.findFirst({ where: eq(taxes.id, id) });
  if (!before) return { error: "Tax not found." };

  const usage = await db
    .select({ n: count() })
    .from(bookingTaxes)
    .where(eq(bookingTaxes.taxId, id));

  const isUsed = (usage[0]?.n ?? 0) > 0;

  await db.transaction(async (tx) => {
    if (isUsed) {
      await tx.update(taxes).set({ active: 0 }).where(eq(taxes.id, id));
      await audit(tx, {
        userId: user.id,
        action: "update",
        module: "tax",
        recordId: id,
        summary: `Deactivated tax "${before.name}" (in use on past bookings)`,
      });
    } else {
      await tx.update(taxes).set({ deletedAt: Math.floor(Date.now() / 1000) }).where(eq(taxes.id, id));
      await audit(tx, {
        userId: user.id,
        action: "delete",
        module: "tax",
        recordId: id,
        summary: `Deleted tax "${before.name}"`,
      });
    }
  });

  revalidatePath("/taxes");
  return { deactivated: isUsed };
}
