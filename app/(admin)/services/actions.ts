"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/lib/db";
import { bookingServices, menuItems, services } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/require-role";
import { audit, diff } from "@/lib/audit";

const CATEGORIES = [
  "sound",
  "lighting",
  "entry",
  "decor",
  "catering",
  "photography",
  "furniture",
  "misc",
] as const;

const menuItemSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["starter", "main", "rice", "bbq", "bread", "side", "dessert", "drink"]),
  perHeadPricePaisa: z.number().int().nonnegative().optional(),
});

const serviceSchema = z.object({
  name: z.string().min(2).max(100),
  category: z.enum(CATEGORIES),
  description: z.string().optional(),
  pricingType: z.enum(["fixed", "per_head", "per_hour", "per_unit"]),
  ratePaisa: z.number().int().nonnegative(),
  taxable: z.boolean(),
  active: z.boolean(),
  menuItems: z.array(menuItemSchema).optional(),
});

export type ServiceInput = z.infer<typeof serviceSchema>;

export interface ActionResult {
  error?: string;
  id?: string;
}

export async function createService(input: ServiceInput): Promise<ActionResult> {
  const user = await requireRole("admin");
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const data = parsed.data;

  const id = nanoid();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(services).values({
        id,
        name: data.name,
        category: data.category,
        description: data.description || null,
        pricingType: data.pricingType,
        rate: data.ratePaisa,
        taxable: data.taxable ? 1 : 0,
        active: data.active ? 1 : 0,
        createdAt: Math.floor(Date.now() / 1000),
      });

      if (data.category === "catering" && data.menuItems?.length) {
        await tx.insert(menuItems).values(
          data.menuItems.map((m, i) => ({
            id: nanoid(),
            serviceId: id,
            name: m.name,
            type: m.type,
            perHeadPrice: m.perHeadPricePaisa ?? null,
            sortOrder: i,
          })),
        );
      }

      await audit(tx, {
        userId: user.id,
        action: "create",
        module: "service",
        recordId: id,
        summary: `Created service "${data.name}"`,
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("UNIQUE")) {
      return { error: "A service with this name already exists in this category." };
    }
    throw err;
  }

  revalidatePath("/services");
  redirect("/services");
}

export async function updateService(id: string, input: ServiceInput): Promise<ActionResult> {
  const user = await requireRole("admin");
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const data = parsed.data;

  const before = await db.query.services.findFirst({ where: eq(services.id, id) });
  if (!before) return { error: "Service not found." };

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(services)
        .set({
          name: data.name,
          category: data.category,
          description: data.description || null,
          pricingType: data.pricingType,
          rate: data.ratePaisa,
          taxable: data.taxable ? 1 : 0,
          active: data.active ? 1 : 0,
        })
        .where(eq(services.id, id));

      // Replace the default menu wholesale — this only edits the service's
      // default dish list, never menus already snapshotted onto bookings.
      if (data.category === "catering") {
        await tx.delete(menuItems).where(eq(menuItems.serviceId, id));
        if (data.menuItems?.length) {
          await tx.insert(menuItems).values(
            data.menuItems.map((m, i) => ({
              id: nanoid(),
              serviceId: id,
              name: m.name,
              type: m.type,
              perHeadPrice: m.perHeadPricePaisa ?? null,
              sortOrder: i,
            })),
          );
        }
      }

      await audit(tx, {
        userId: user.id,
        action: "update",
        module: "service",
        recordId: id,
        summary: `Updated service "${data.name}"`,
        changes: diff(
          {
            name: before.name,
            category: before.category,
            pricingType: before.pricingType,
            rate: before.rate,
            taxable: before.taxable,
            active: before.active,
          },
          {
            name: data.name,
            category: data.category,
            pricingType: data.pricingType,
            rate: data.ratePaisa,
            taxable: data.taxable ? 1 : 0,
            active: data.active ? 1 : 0,
          },
        ),
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("UNIQUE")) {
      return { error: "A service with this name already exists in this category." };
    }
    throw err;
  }

  revalidatePath("/services");
  revalidatePath(`/services/${id}`);
  redirect("/services");
}

export async function deleteOrDeactivateService(
  id: string,
): Promise<ActionResult & { deactivated?: boolean }> {
  const user = await requireRole("admin");

  const before = await db.query.services.findFirst({ where: eq(services.id, id) });
  if (!before) return { error: "Service not found." };

  const usage = await db
    .select({ n: count() })
    .from(bookingServices)
    .where(eq(bookingServices.serviceId, id));
  const isUsed = (usage[0]?.n ?? 0) > 0;

  await db.transaction(async (tx) => {
    if (isUsed) {
      await tx.update(services).set({ active: 0 }).where(eq(services.id, id));
      await audit(tx, {
        userId: user.id,
        action: "update",
        module: "service",
        recordId: id,
        summary: `Deactivated service "${before.name}" (in use on ${usage[0]?.n} bookings)`,
      });
    } else {
      await tx
        .update(services)
        .set({ deletedAt: Math.floor(Date.now() / 1000) })
        .where(eq(services.id, id));
      await audit(tx, {
        userId: user.id,
        action: "delete",
        module: "service",
        recordId: id,
        summary: `Deleted service "${before.name}"`,
      });
    }
  });

  revalidatePath("/services");
  return { deactivated: isUsed };
}
