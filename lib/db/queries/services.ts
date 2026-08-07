import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "../index";
import { menuItems, services } from "../schema";
import type { Transaction } from "../../calculations";

export async function listServices() {
  return db
    .select({
      id: services.id,
      name: services.name,
      category: services.category,
      pricingType: services.pricingType,
      rate: services.rate,
      taxable: services.taxable,
      active: services.active,
      isSystem: services.isSystem,
    })
    .from(services)
    .where(isNull(services.deletedAt))
    // System services (Hall Rent) sort first — it's the first line of every
    // booking, so it belongs at the top of the catalogue too.
    .orderBy(desc(services.isSystem), asc(services.category), asc(services.name));
}

export type PricingType = "fixed" | "per_head" | "per_hour" | "per_unit";

export interface ActiveService {
  id: string;
  name: string;
  category: string;
  pricingType: PricingType;
  rate: number;
  taxable: number;
}

// Services offered in the booking wizard's picker. System services are
// deliberately excluded: Hall Rent is already the pinned first line, fed by
// bookings.hall_rent, so offering it here would let it be added a second time
// and counted twice in the subtotal.
export async function listActiveServices(
  handle: Transaction | typeof db = db,
): Promise<ActiveService[]> {
  const rows = await handle
    .select({
      id: services.id,
      name: services.name,
      category: services.category,
      pricingType: services.pricingType,
      rate: services.rate,
      taxable: services.taxable,
    })
    .from(services)
    .where(
      and(eq(services.active, 1), eq(services.isSystem, 0), isNull(services.deletedAt)),
    )
    .orderBy(asc(services.category), asc(services.name));

  return rows as ActiveService[];
}

// The venue-rental service, whose rate is the default hall rent on a new
// booking. Returns null if it's missing so callers degrade to "no default"
// rather than breaking.
export async function getHallRentService(): Promise<{ name: string; rate: number } | null> {
  const row = await db
    .select({ name: services.name, rate: services.rate })
    .from(services)
    .where(
      and(eq(services.isSystem, 1), eq(services.active, 1), isNull(services.deletedAt)),
    )
    .limit(1);

  return row[0] ?? null;
}

export async function getCateringMenuByService(): Promise<
  Record<string, { name: string; type: string }[]>
> {
  const rows = await db
    .select({
      serviceId: menuItems.serviceId,
      name: menuItems.name,
      type: menuItems.type,
    })
    .from(menuItems)
    .innerJoin(services, eq(services.id, menuItems.serviceId))
    .where(and(eq(services.category, "catering"), isNull(services.deletedAt)))
    .orderBy(asc(menuItems.sortOrder));

  const result: Record<string, { name: string; type: string }[]> = {};
  for (const row of rows) {
    (result[row.serviceId] ??= []).push({ name: row.name, type: row.type });
  }
  return result;
}

export async function getServiceWithMenu(id: string) {
  const service = await db.query.services.findFirst({ where: eq(services.id, id) });
  if (!service) return null;
  const items = await db
    .select()
    .from(menuItems)
    .where(eq(menuItems.serviceId, id))
    .orderBy(asc(menuItems.sortOrder));
  return { service, menuItems: items };
}
