import "server-only";
import { nanoid } from "nanoid";
import type { Transaction } from "../calculations";
import { menuItems, services, settings, taxes } from "./schema";
import {
  SEED_DEFAULT_TAX,
  SEED_SERVICES,
  SEED_SETTINGS_DEFAULTS,
} from "./seed-data";

export interface SeedOptions {
  /** Extra/overriding settings entries (e.g. venue details from the setup wizard). */
  extraSettings?: Record<string, string>;
}

const now = () => Math.floor(Date.now() / 1000);

// Inserts the seed catalogue (services + catering menu, default tax) and base
// settings. Idempotent-ish for a fresh database only — intended to run once,
// either from the first-run setup wizard or `npm run db:seed` in dev.
export async function seedInitialData(tx: Transaction, opts: SeedOptions = {}): Promise<void> {
  for (const svc of SEED_SERVICES) {
    const serviceId = nanoid();
    await tx.insert(services).values({
      id: serviceId,
      name: svc.name,
      category: svc.category,
      pricingType: svc.pricingType,
      rate: svc.ratePaisa,
      taxable: 1,
      active: 1,
      isSystem: svc.isSystem ? 1 : 0,
      createdAt: now(),
    });

    if (svc.menuItems?.length) {
      await tx.insert(menuItems).values(
        svc.menuItems.map((item, i) => ({
          id: nanoid(),
          serviceId,
          name: item.name,
          type: item.type,
          sortOrder: i,
        })),
      );
    }
  }

  await tx.insert(taxes).values({
    id: nanoid(),
    name: SEED_DEFAULT_TAX.name,
    type: SEED_DEFAULT_TAX.type,
    rate: SEED_DEFAULT_TAX.rateBps,
    active: 1,
    isDefault: SEED_DEFAULT_TAX.isDefault ? 1 : 0,
    sortOrder: 0,
    createdAt: now(),
  });

  const merged = { ...SEED_SETTINGS_DEFAULTS, ...opts.extraSettings };
  await tx
    .insert(settings)
    .values(Object.entries(merged).map(([key, value]) => ({ key, value })));
}
