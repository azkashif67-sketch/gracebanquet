import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "../index";
import { menuItems, services } from "../schema";

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
    })
    .from(services)
    .where(isNull(services.deletedAt))
    .orderBy(asc(services.category), asc(services.name));
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

export async function listActiveServices(): Promise<ActiveService[]> {
  const rows = await db
    .select({
      id: services.id,
      name: services.name,
      category: services.category,
      pricingType: services.pricingType,
      rate: services.rate,
      taxable: services.taxable,
    })
    .from(services)
    .where(and(eq(services.active, 1), isNull(services.deletedAt)))
    .orderBy(asc(services.category), asc(services.name));

  return rows as ActiveService[];
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
