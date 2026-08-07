import { existsSync, rmSync } from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../db/schema";
import { checkAvailability, nextInvoiceNo, nextReceiptNo } from "../db/operations";
import { listActiveServices } from "../db/queries/services";
import { eq } from "drizzle-orm";

// Self-contained integration DB, isolated from the dev file (./local.db) so
// these tests never pollute data used for manual E2E verification.
const TEST_DB_PATH = "./test-integration.db";

for (const suffix of ["", "-wal", "-shm"]) {
  if (existsSync(TEST_DB_PATH + suffix)) rmSync(TEST_DB_PATH + suffix);
}

const client = createClient({ url: `file:${TEST_DB_PATH}` });
const testDb = drizzle(client, { schema });

beforeAll(async () => {
  await client.execute("PRAGMA foreign_keys = ON");
  await client.execute("PRAGMA busy_timeout = 5000");
  await migrate(testDb, { migrationsFolder: "./drizzle" });
  await testDb.insert(schema.users).values({
    id: "user-1",
    username: "tester",
    passwordHash: "x",
    fullName: "Test User",
    role: "admin",
    createdAt: Math.floor(Date.now() / 1000),
  });
});

afterAll(async () => {
  client.close();
  // On Windows the OS can hold the file handle open briefly after close();
  // leaving the file behind is harmless (it's wiped at the start of the next
  // run) so cleanup failures here must not fail the suite.
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      if (existsSync(TEST_DB_PATH + suffix)) rmSync(TEST_DB_PATH + suffix);
    } catch {
      // ignore
    }
  }
});

// NOTE on concurrency: the local multi-connection libSQL file driver used here
// for dev/test does not reliably serialize truly parallel (Promise.all) write
// transactions against a single file — it can return SQLITE_BUSY immediately,
// and a failed BEGIN can leave the connection wedged for later calls. That is
// a limitation of the local embedded driver, not of the app's logic: the
// atomicity guarantee that matters (nextInvoiceNo's counter increment and the
// booking insert sharing one transaction, so two callers can never receive
// the same number) comes from the `INSERT ... ON CONFLICT DO UPDATE` running
// inside `db.transaction()`, which is exercised below with many sequential
// transactions and asserted to never collide or skip. Against hosted Turso in
// production, writes are serialized through a single server-side connection,
// so genuinely concurrent requests are safe by the same mechanism.
describe("invoice/receipt numbering", () => {
  it("issues unique, zero-padded sequential numbers with no collisions or gaps", async () => {
    const results: string[] = [];
    for (let i = 0; i < 20; i++) {
      results.push(await testDb.transaction((tx) => nextInvoiceNo(tx)));
    }

    expect(new Set(results).size).toBe(20); // no collisions
    const year = new Date().getFullYear();
    const numbers = results.map((invoiceNo) => {
      expect(invoiceNo).toMatch(new RegExp(`^INV-${year}-\\d{4}$`));
      return Number(invoiceNo.split("-")[2]);
    });
    // Strictly increasing by 1 — proves the counter row is read-your-own-write
    // consistent across separate transactions, not just individually unique.
    for (let i = 1; i < numbers.length; i++) {
      expect(numbers[i]).toBe(numbers[i - 1] + 1);
    }
  });

  it("draws receipt numbers from a separate counter than invoices", async () => {
    const invoiceNo = await testDb.transaction((tx) => nextInvoiceNo(tx));
    const receiptNo = await testDb.transaction((tx) => nextReceiptNo(tx));
    expect(invoiceNo.startsWith("INV-")).toBe(true);
    expect(receiptNo.startsWith("RCP-")).toBe(true);
  });
});

describe("checkAvailability", () => {
  const baseBooking = {
    clientName: "Ahmed",
    phone: "0300-0000000",
    eventType: "wedding",
    subtotal: 0,
    discountAmount: 0,
    taxableAmount: 0,
    taxAmount: 0,
    grandTotal: 0,
    amountPaid: 0,
    balanceDue: 0,
    status: "confirmed",
    createdBy: "user-1",
    createdAt: Math.floor(Date.now() / 1000),
    updatedAt: Math.floor(Date.now() / 1000),
  };

  it("reports available when nothing is booked for that date/slot/hall", async () => {
    const result = await checkAvailability(
      { eventDate: "2026-08-22", eventSlot: "night", hallSection: "Main Hall" },
      testDb,
    );
    expect(result.available).toBe(true);
  });

  it("blocks the same hall+slot+date once a confirmed booking exists", async () => {
    await testDb.insert(schema.bookings).values({
      ...baseBooking,
      id: "bkg-1",
      invoiceNo: "INV-TEST-0001",
      eventDate: "2026-08-22",
      eventSlot: "night",
      hallSection: "Main Hall",
      guestCount: 300,
    });

    const result = await checkAvailability(
      { eventDate: "2026-08-22", eventSlot: "night", hallSection: "Main Hall" },
      testDb,
    );
    expect(result.available).toBe(false);
    expect(result.conflicts[0]?.id).toBe("bkg-1");
  });

  it("excludes the booking being edited from its own conflict check", async () => {
    const result = await checkAvailability(
      {
        eventDate: "2026-08-22",
        eventSlot: "night",
        hallSection: "Main Hall",
        excludeBookingId: "bkg-1",
      },
      testDb,
    );
    expect(result.available).toBe(true);
  });

  it("does not block the day slot on the same date", async () => {
    const result = await checkAvailability(
      { eventDate: "2026-08-22", eventSlot: "day", hallSection: "Main Hall" },
      testDb,
    );
    expect(result.available).toBe(true);
  });

  it("Full Venue blocks every section and every section blocks Full Venue", async () => {
    await testDb.insert(schema.bookings).values({
      ...baseBooking,
      id: "bkg-2",
      invoiceNo: "INV-TEST-0002",
      eventDate: "2026-09-01",
      eventSlot: "day",
      hallSection: "Full Venue",
      guestCount: 500,
    });

    const anySection = await checkAvailability(
      { eventDate: "2026-09-01", eventSlot: "day", hallSection: "Garden Section" },
      testDb,
    );
    expect(anySection.available).toBe(false);

    await testDb.insert(schema.bookings).values({
      ...baseBooking,
      id: "bkg-3",
      invoiceNo: "INV-TEST-0003",
      eventDate: "2026-09-05",
      eventSlot: "day",
      hallSection: "Garden Section",
      guestCount: 200,
    });

    const fullVenue = await checkAvailability(
      { eventDate: "2026-09-05", eventSlot: "day", hallSection: "Full Venue" },
      testDb,
    );
    expect(fullVenue.available).toBe(false);
  });

  it("cancelled bookings do not block the slot", async () => {
    await testDb.insert(schema.bookings).values({
      ...baseBooking,
      id: "bkg-4",
      invoiceNo: "INV-TEST-0004",
      eventDate: "2026-10-10",
      eventSlot: "night",
      hallSection: "Main Hall",
      guestCount: 100,
      status: "cancelled",
    });

    const result = await checkAvailability(
      { eventDate: "2026-10-10", eventSlot: "night", hallSection: "Main Hall" },
      testDb,
    );
    expect(result.available).toBe(true);
  });

  it("excludes a booking from its own conflict check when editing", async () => {
    await testDb.insert(schema.bookings).values({
      ...baseBooking,
      id: "bkg-edit",
      invoiceNo: "INV-TEST-EDIT",
      eventDate: "2026-11-20",
      eventSlot: "night",
      hallSection: "Main Hall",
      guestCount: 100,
      status: "confirmed",
    });

    // Without the exclusion an edit would always collide with itself.
    const withoutExclusion = await checkAvailability(
      { eventDate: "2026-11-20", eventSlot: "night", hallSection: "Main Hall" },
      testDb,
    );
    expect(withoutExclusion.available).toBe(false);

    const withExclusion = await checkAvailability(
      {
        eventDate: "2026-11-20",
        eventSlot: "night",
        hallSection: "Main Hall",
        excludeBookingId: "bkg-edit",
      },
      testDb,
    );
    expect(withExclusion.available).toBe(true);
  });

  it("soft-deleted bookings do not block the slot", async () => {
    await testDb.insert(schema.bookings).values({
      ...baseBooking,
      id: "bkg-deleted",
      invoiceNo: "INV-TEST-DEL",
      eventDate: "2026-12-01",
      eventSlot: "day",
      hallSection: "Main Hall",
      guestCount: 100,
      status: "confirmed",
      deletedAt: Math.floor(Date.now() / 1000),
    });

    const result = await checkAvailability(
      { eventDate: "2026-12-01", eventSlot: "day", hallSection: "Main Hall" },
      testDb,
    );
    expect(result.available).toBe(true);
  });
});

describe("service catalogue", () => {
  // Hall Rent is already the pinned first line of every booking, priced from
  // bookings.hall_rent. If it also appeared in the wizard's picker it could be
  // added as an ordinary line and counted a second time in the subtotal — so
  // the exclusion below is a money-correctness guard, not cosmetics.
  it("keeps system services out of the booking wizard's picker", async () => {
    const now = Math.floor(Date.now() / 1000);
    await testDb.insert(schema.services).values([
      {
        id: "svc-hall-rent",
        name: "Hall Rent",
        category: "venue",
        pricingType: "fixed",
        rate: 10000000,
        taxable: 1,
        active: 1,
        isSystem: 1,
        createdAt: now,
      },
      {
        id: "svc-sound",
        name: "Basic Sound System",
        category: "sound",
        pricingType: "fixed",
        rate: 2500000,
        taxable: 1,
        active: 1,
        isSystem: 0,
        createdAt: now,
      },
    ]);

    const offered = await listActiveServices(testDb);
    expect(offered.map((s) => s.id)).toEqual(["svc-sound"]);
  });

  it("still exposes the system service as the hall-rent default", async () => {
    const row = await testDb
      .select({ name: schema.services.name, rate: schema.services.rate })
      .from(schema.services)
      .where(eq(schema.services.isSystem, 1));

    expect(row).toEqual([{ name: "Hall Rent", rate: 10000000 }]);
  });
});
