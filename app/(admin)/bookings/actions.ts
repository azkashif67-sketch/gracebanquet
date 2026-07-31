"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  bookingExtras,
  bookingMenu,
  bookingServices,
  bookingTaxes,
  bookings,
  payments,
  taxes,
} from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/require-role";
import { audit } from "@/lib/audit";
import { calculateTotals } from "@/lib/calculations";
import {
  checkAvailability,
  nextInvoiceNo,
  nextReceiptNo,
  type AvailabilityResult,
} from "@/lib/db/operations";
import { getVenueSettings } from "@/lib/db/queries/settings";
import { findClientByPhone } from "@/lib/db/queries/bookings";

export async function lookupClientByPhone(phone: string) {
  await requireRole("admin", "manager", "staff");
  if (!phone || phone.trim().length < 3) return null;
  return findClientByPhone(phone.trim());
}

// ---------------------------------------------------------------------------
// Live availability check (advisory — the wizard debounces this as the user
// picks a date/slot/hall). The authoritative check re-runs inside the save
// transaction below; this one only saves a round trip so the "Next" button
// doesn't need to.
// ---------------------------------------------------------------------------
export async function checkAvailabilityAction(params: {
  eventDate: string;
  eventSlot: "day" | "night";
  hallSection: string;
  excludeBookingId?: string;
}): Promise<AvailabilityResult> {
  await requireRole("admin", "manager", "staff");
  return checkAvailability(params);
}

const serviceLineSchema = z.object({
  serviceId: z.string(),
  serviceName: z.string(),
  pricingType: z.enum(["fixed", "per_head", "per_hour", "per_unit"]),
  qty: z.number().positive(),
  ratePaisa: z.number().int().nonnegative(),
  taxable: z.boolean(),
});

const menuLineSchema = z.object({
  itemName: z.string().min(1),
  type: z.string().min(1),
});

const extraLineSchema = z.object({
  label: z.string().min(1),
  qty: z.number().positive(),
  ratePaisa: z.number().int(),
  taxable: z.boolean(),
});

const bookingSchema = z.object({
  clientName: z.string().min(1),
  phone: z.string().min(1),
  altPhone: z.string().optional(),
  cnic: z.string().optional(),
  address: z.string().optional(),

  eventType: z.string().min(1),
  eventDate: z.string().min(1),
  eventSlot: z.enum(["day", "night"]),
  hallSection: z.string().min(1),
  guestCount: z.number().int().positive(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  status: z.enum(["confirmed", "tentative"]),
  holdExpiresOn: z.string().optional(),
  overrideReason: z.string().optional(),

  services: z.array(serviceLineSchema),
  menu: z.array(menuLineSchema),
  extras: z.array(extraLineSchema),

  discountAmountPaisa: z.number().int().nonnegative(),
  discountReason: z.string().optional(),
  taxIds: z.array(z.string()),

  advanceAmountPaisa: z.number().int().nonnegative(),
  paymentMethod: z.enum(["cash", "bank", "cheque", "easypaisa", "jazzcash"]).optional(),
  paymentDate: z.string().optional(),
  paymentReference: z.string().optional(),
  dueDate: z.string().optional(),

  internalNotes: z.string().optional(),
  clientNotes: z.string().optional(),
  specialInstructions: z.string().optional(),
});

export type BookingInput = z.infer<typeof bookingSchema>;

export interface CreateBookingResult {
  error?: string;
  conflicts?: AvailabilityResult["conflicts"];
  id?: string;
  invoiceNo?: string;
}

class ConflictError extends Error {
  constructor(public conflicts: AvailabilityResult["conflicts"]) {
    super("Slot is not available");
  }
}

export async function createBooking(input: BookingInput): Promise<CreateBookingResult> {
  const user = await requireRole("admin", "manager", "staff");
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid booking data." };
  }
  const data = parsed.data;

  if (data.discountAmountPaisa > 0 && !data.discountReason) {
    return { error: "Discount reason is required when a discount is applied." };
  }
  if ((user.role === "staff") && data.discountAmountPaisa > 0) {
    return { error: "Staff cannot apply discounts." };
  }
  if (data.overrideReason && user.role !== "admin") {
    return { error: "Only an admin can override an availability conflict." };
  }

  const venueSettings = await getVenueSettings();

  let result: { id: string; invoiceNo: string };
  try {
    result = await db.transaction(async (tx) => {
      // 1. AUTHORITATIVE availability re-check — the live check in the wizard
      //    is only advisory; another user may have booked it since.
      const { available, conflicts } = await checkAvailability(
        {
          eventDate: data.eventDate,
          eventSlot: data.eventSlot,
          hallSection: data.hallSection,
        },
        tx,
      );
      if (!available && !data.overrideReason) {
        throw new ConflictError(conflicts);
      }

      // 2. Resolve taxes server-side (never trust a client-supplied rate) and
      //    recompute totals inside the transaction.
      const selectedTaxes = data.taxIds.length
        ? await tx.select().from(taxes).where(inArray(taxes.id, data.taxIds))
        : [];

      const totals = calculateTotals({
        serviceLines: data.services.map((s) => ({
          qty: s.qty,
          rate: s.ratePaisa,
          taxable: s.taxable,
        })),
        extraLines: data.extras.map((e) => ({
          qty: e.qty,
          rate: e.ratePaisa,
          taxable: e.taxable,
        })),
        discountAmount: data.discountAmountPaisa,
        taxes: selectedTaxes.map((t) => ({ id: t.id, name: t.name, rateBps: t.rate })),
        taxOnDiscounted: venueSettings.taxOnDiscounted,
      });

      // 3. Invoice number — same transaction, atomic counter. Drafts don't
      //    consume a number (out of Phase 1 scope: only confirmed/tentative
      //    are created here).
      const invoiceNo = await nextInvoiceNo(tx);

      // 4. Booking row
      const id = nanoid();
      const nowSec = Math.floor(Date.now() / 1000);
      await tx.insert(bookings).values({
        id,
        invoiceNo,
        clientName: data.clientName,
        phone: data.phone,
        altPhone: data.altPhone || null,
        cnic: data.cnic || null,
        address: data.address || null,
        eventType: data.eventType,
        eventDate: data.eventDate,
        eventSlot: data.eventSlot,
        hallSection: data.hallSection,
        guestCount: data.guestCount,
        startTime: data.startTime || null,
        endTime: data.endTime || null,
        subtotal: totals.subtotal,
        discountAmount: totals.discount,
        discountReason: data.discountReason || null,
        taxableAmount: totals.taxableAmount,
        taxAmount: totals.taxAmount,
        grandTotal: totals.grandTotal,
        amountPaid: data.advanceAmountPaisa,
        balanceDue: totals.grandTotal - data.advanceAmountPaisa,
        dueDate: data.dueDate || null,
        status: data.status,
        holdExpiresOn: data.status === "tentative" ? data.holdExpiresOn || null : null,
        internalNotes: data.internalNotes || null,
        clientNotes: data.clientNotes || null,
        specialInstructions: data.specialInstructions || null,
        createdBy: user.id,
        createdAt: nowSec,
        updatedAt: nowSec,
      });

      // 5. Child rows
      if (data.services.length) {
        await tx.insert(bookingServices).values(
          data.services.map((s, i) => ({
            id: nanoid(),
            bookingId: id,
            serviceId: s.serviceId,
            serviceName: s.serviceName,
            pricingType: s.pricingType,
            qty: s.qty,
            rate: s.ratePaisa,
            lineTotal: s.qty * s.ratePaisa,
            taxable: s.taxable ? 1 : 0,
            sortOrder: i,
          })),
        );
      }
      if (data.menu.length) {
        await tx.insert(bookingMenu).values(
          data.menu.map((m) => ({ id: nanoid(), bookingId: id, itemName: m.itemName, type: m.type })),
        );
      }
      if (data.extras.length) {
        await tx.insert(bookingExtras).values(
          data.extras.map((e) => ({
            id: nanoid(),
            bookingId: id,
            label: e.label,
            qty: e.qty,
            rate: e.ratePaisa,
            lineTotal: e.qty * e.ratePaisa,
            taxable: e.taxable ? 1 : 0,
          })),
        );
      }
      if (totals.taxLines.length) {
        await tx.insert(bookingTaxes).values(
          totals.taxLines.map((t) => ({
            id: nanoid(),
            bookingId: id,
            taxId: t.id,
            taxName: t.name,
            rate: t.rateBps,
            taxAmount: t.amount,
          })),
        );
      }

      // 6. Advance payment as a real ledger row
      if (data.advanceAmountPaisa > 0) {
        await tx.insert(payments).values({
          id: nanoid(),
          bookingId: id,
          receiptNo: await nextReceiptNo(tx),
          amount: data.advanceAmountPaisa,
          method: data.paymentMethod ?? "cash",
          paidOn: data.paymentDate || data.eventDate,
          recordedBy: user.id,
          createdAt: nowSec,
        });
      }

      // 7. Audit (override reason, if any, is logged explicitly)
      await audit(tx, {
        userId: user.id,
        action: "create",
        module: "booking",
        recordId: id,
        summary: data.overrideReason
          ? `Created booking ${invoiceNo} for ${data.clientName} (availability override: ${data.overrideReason})`
          : `Created booking ${invoiceNo} for ${data.clientName}`,
      });

      return { id, invoiceNo };
    });
  } catch (err) {
    if (err instanceof ConflictError) {
      return { error: "This date/slot/hall is no longer available.", conflicts: err.conflicts };
    }
    throw err;
  }

  revalidatePath("/bookings");
  revalidatePath("/schedule");
  redirect(`/bookings/${result.id}?created=1`);
}

