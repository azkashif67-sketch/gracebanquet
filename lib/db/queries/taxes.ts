import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../index";
import { taxes } from "../schema";

export async function listActiveTaxes() {
  return db
    .select({
      id: taxes.id,
      name: taxes.name,
      type: taxes.type,
      rate: taxes.rate,
      isDefault: taxes.isDefault,
    })
    .from(taxes)
    .where(and(eq(taxes.active, 1), isNull(taxes.deletedAt)))
    .orderBy(taxes.sortOrder);
}

export async function listAllTaxes() {
  return db
    .select({
      id: taxes.id,
      name: taxes.name,
      type: taxes.type,
      rate: taxes.rate,
      active: taxes.active,
      isDefault: taxes.isDefault,
    })
    .from(taxes)
    .where(isNull(taxes.deletedAt))
    .orderBy(taxes.sortOrder);
}
