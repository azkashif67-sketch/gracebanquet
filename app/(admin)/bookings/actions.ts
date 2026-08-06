"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  bookingExtras,
  bookingMenu,
  bookingServices,
  bookingTaxes,
  bookings,
  inquiries,
  installments,
  payments,
  quotations,
  taxes,
} from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/require-role";
import { audit, diff } from "@/lib/audit";
import { calculateTotals } from "@/lib/calculations";
import {
  checkAvailability,
  nextInvoiceNo,
  nextReceiptNo,
  type AvailabilityResult,
} from "@/lib/db/operations";
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

const installmentLineSchema = z.object({
  label: z.string().min(1),
  amountPaisa: z.number().int().positive(),
  dueDate: z.string().min(1),
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

  hallRentPaisa: z.number().int().nonnegative(),
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
  installments: z.array(installmentLineSchema).optional(),

  sourceQuotationId: z.string().optional(),
  sourceInquiryId: z.string().optional(),

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

class ValidationError extends Error {}

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
      //    recompute totals inside the transaction. Only live taxes apply —
      //    a deactivated or deleted one must not attach to a new booking.
      const selectedTaxes = data.taxIds.length
        ? await tx
            .select()
            .from(taxes)
            .where(
              and(
                inArray(taxes.id, data.taxIds),
                eq(taxes.active, 1),
                isNull(taxes.deletedAt),
              ),
            )
        : [];

      const totals = calculateTotals({
        hallRent: data.hallRentPaisa,
        serviceLines: data.services.map((s) => ({ qty: s.qty, rate: s.ratePaisa })),
        extraLines: data.extras.map((e) => ({ qty: e.qty, rate: e.ratePaisa })),
        discountAmount: data.discountAmountPaisa,
        taxes: selectedTaxes.map((t) => ({ id: t.id, name: t.name, rateBps: t.rate })),
      });

      // 2b. An installment plan, if given, must reconcile to the grand total
      //    — checked here (not just client-side) since totals are only known
      //    for certain once resolved server-side above.
      if (data.installments?.length) {
        const planSum = data.installments.reduce((s, i) => s + i.amountPaisa, 0);
        if (planSum !== totals.grandTotal) {
          throw new ValidationError(
            `Installment plan (${planSum}) does not match the grand total (${totals.grandTotal}).`,
          );
        }
      }

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
        hallRent: data.hallRentPaisa,
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
      if (data.installments?.length) {
        await tx.insert(installments).values(
          data.installments.map((inst, i) => ({
            id: nanoid(),
            bookingId: id,
            label: inst.label,
            amount: inst.amountPaisa,
            dueDate: inst.dueDate,
            sortOrder: i,
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

      // 8. If this booking came from converting a quotation or inquiry,
      //    close the loop in the same transaction — no re-entry, per spec
      //    §9.11 / §11.3.
      if (data.sourceQuotationId) {
        await tx
          .update(quotations)
          .set({ status: "converted", convertedBookingId: id, updatedAt: nowSec })
          .where(eq(quotations.id, data.sourceQuotationId));
        await audit(tx, {
          userId: user.id,
          action: "update",
          module: "quotation",
          recordId: data.sourceQuotationId,
          summary: `Converted to booking ${invoiceNo}`,
        });
      }
      if (data.sourceInquiryId) {
        await tx
          .update(inquiries)
          .set({ status: "converted", convertedBookingId: id })
          .where(eq(inquiries.id, data.sourceInquiryId));
        await audit(tx, {
          userId: user.id,
          action: "update",
          module: "inquiry",
          recordId: data.sourceInquiryId,
          summary: `Converted to booking ${invoiceNo}`,
        });
      }

      return { id, invoiceNo };
    });
  } catch (err) {
    if (err instanceof ConflictError) {
      return { error: "This date/slot/hall is no longer available.", conflicts: err.conflicts };
    }
    if (err instanceof ValidationError) {
      return { error: err.message };
    }
    throw err;
  }

  revalidatePath("/bookings");
  revalidatePath("/schedule");
  redirect(`/bookings/${result.id}?created=1`);
}

// ---------------------------------------------------------------------------
// Payment ledger (spec §9.3)
// ---------------------------------------------------------------------------
const recordPaymentSchema = z.object({
  bookingId: z.string().min(1),
  amountPaisa: z.number().int(), // negative for a refund
  method: z.enum(["cash", "bank", "cheque", "easypaisa", "jazzcash"]),
  paidOn: z.string().min(1),
  reference: z.string().optional(),
  notes: z.string().optional(),
  installmentId: z.string().optional(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export interface RecordPaymentResult {
  error?: string;
  paymentId?: string;
  overpaid?: boolean;
}

export async function recordPayment(input: RecordPaymentInput): Promise<RecordPaymentResult> {
  const user = await requireRole("admin", "manager");
  const parsed = recordPaymentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid payment." };
  const data = parsed.data;

  const booking = await db.query.bookings.findFirst({ where: eq(bookings.id, data.bookingId) });
  if (!booking) return { error: "Booking not found." };

  const { paymentId, newBalance } = await db.transaction(async (tx) => {
    const id = nanoid();
    const receiptNo = await nextReceiptNo(tx);
    const nowSec = Math.floor(Date.now() / 1000);

    await tx.insert(payments).values({
      id,
      bookingId: data.bookingId,
      receiptNo,
      amount: data.amountPaisa,
      method: data.method,
      reference: data.reference || null,
      paidOn: data.paidOn,
      installmentId: data.installmentId || null,
      notes: data.notes || null,
      recordedBy: user.id,
      createdAt: nowSec,
    });

    // Recompute the denormalised totals inside the same transaction — every
    // payment mutation must do this together, never separately (spec §20.4).
    const [{ total }] = await tx
      .select({ total: sql<number>`COALESCE(SUM(${payments.amount}), 0)` })
      .from(payments)
      .where(and(eq(payments.bookingId, data.bookingId), isNull(payments.deletedAt)));

    const balance = booking.grandTotal - total;
    await tx
      .update(bookings)
      .set({ amountPaid: total, balanceDue: balance, updatedAt: nowSec })
      .where(eq(bookings.id, data.bookingId));

    await audit(tx, {
      userId: user.id,
      action: "payment",
      module: "payment",
      recordId: id,
      summary: `Recorded payment ${receiptNo} (${data.amountPaisa < 0 ? "refund" : "payment"}) on ${booking.invoiceNo}`,
    });

    return { paymentId: id, newBalance: balance };
  });

  revalidatePath(`/bookings/${data.bookingId}`);
  revalidatePath("/bookings");
  return { paymentId, overpaid: newBalance < 0 };
}

export interface ActionOutcome {
  error?: string;
}

// ---------------------------------------------------------------------------
// Update booking (spec §9.4)
// Admin may edit any booking; Manager only ones they created themselves.
// A cancelled booking is read-only.
// ---------------------------------------------------------------------------
export async function updateBooking(
  bookingId: string,
  input: BookingInput,
): Promise<CreateBookingResult> {
  const user = await requireRole("admin", "manager");
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid booking data." };
  }
  const data = parsed.data;

  const before = await db.query.bookings.findFirst({ where: eq(bookings.id, bookingId) });
  if (!before || before.deletedAt) return { error: "Booking not found." };
  if (before.status === "cancelled") return { error: "A cancelled booking cannot be edited." };
  if (user.role === "manager" && before.createdBy !== user.id) {
    return { error: "You can only edit bookings you created." };
  }
  if (data.discountAmountPaisa > 0 && !data.discountReason) {
    return { error: "Discount reason is required when a discount is applied." };
  }
  if (data.overrideReason && user.role !== "admin") {
    return { error: "Only an admin can override an availability conflict." };
  }

  try {
    await db.transaction(async (tx) => {
      // Re-check availability, excluding this booking from its own conflict
      // set — otherwise every edit would collide with itself.
      const { available, conflicts } = await checkAvailability(
        {
          eventDate: data.eventDate,
          eventSlot: data.eventSlot,
          hallSection: data.hallSection,
          excludeBookingId: bookingId,
        },
        tx,
      );
      if (!available && !data.overrideReason) throw new ConflictError(conflicts);

      const selectedTaxes = data.taxIds.length
        ? await tx
            .select()
            .from(taxes)
            .where(
              and(inArray(taxes.id, data.taxIds), eq(taxes.active, 1), isNull(taxes.deletedAt)),
            )
        : [];

      const totals = calculateTotals({
        hallRent: data.hallRentPaisa,
        serviceLines: data.services.map((s) => ({ qty: s.qty, rate: s.ratePaisa })),
        extraLines: data.extras.map((e) => ({ qty: e.qty, rate: e.ratePaisa })),
        discountAmount: data.discountAmountPaisa,
        taxes: selectedTaxes.map((t) => ({ id: t.id, name: t.name, rateBps: t.rate })),
      });

      // Payments already taken are untouched by an edit, so the balance is
      // re-derived from them rather than from any advance field.
      const [{ paid }] = await tx
        .select({ paid: sql<number>`COALESCE(SUM(${payments.amount}), 0)` })
        .from(payments)
        .where(and(eq(payments.bookingId, bookingId), isNull(payments.deletedAt)));

      if (totals.grandTotal < paid) {
        throw new ValidationError(
          "The new total is below what the client has already paid. Refund the difference first.",
        );
      }

      const nowSec = Math.floor(Date.now() / 1000);
      await tx
        .update(bookings)
        .set({
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
          hallRent: data.hallRentPaisa,
          subtotal: totals.subtotal,
          discountAmount: totals.discount,
          discountReason: data.discountReason || null,
          taxableAmount: totals.taxableAmount,
          taxAmount: totals.taxAmount,
          grandTotal: totals.grandTotal,
          amountPaid: paid,
          balanceDue: totals.grandTotal - paid,
          dueDate: data.dueDate || null,
          status: data.status,
          holdExpiresOn: data.status === "tentative" ? data.holdExpiresOn || null : null,
          internalNotes: data.internalNotes || null,
          clientNotes: data.clientNotes || null,
          specialInstructions: data.specialInstructions || null,
          updatedAt: nowSec,
        })
        .where(eq(bookings.id, bookingId));

      // Child rows are replaced wholesale — simpler and safer than diffing,
      // and it's the snapshots that matter, not the row identities.
      await tx.delete(bookingServices).where(eq(bookingServices.bookingId, bookingId));
      await tx.delete(bookingExtras).where(eq(bookingExtras.bookingId, bookingId));
      await tx.delete(bookingMenu).where(eq(bookingMenu.bookingId, bookingId));
      await tx.delete(bookingTaxes).where(eq(bookingTaxes.bookingId, bookingId));

      if (data.services.length) {
        await tx.insert(bookingServices).values(
          data.services.map((s, i) => ({
            id: nanoid(),
            bookingId,
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
          data.menu.map((m) => ({ id: nanoid(), bookingId, itemName: m.itemName, type: m.type })),
        );
      }
      if (data.extras.length) {
        await tx.insert(bookingExtras).values(
          data.extras.map((e) => ({
            id: nanoid(),
            bookingId,
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
            bookingId,
            taxId: t.id,
            taxName: t.name,
            rate: t.rateBps,
            taxAmount: t.amount,
          })),
        );
      }

      await audit(tx, {
        userId: user.id,
        action: "update",
        module: "booking",
        recordId: bookingId,
        summary: data.overrideReason
          ? `Updated booking ${before.invoiceNo} (availability override: ${data.overrideReason})`
          : `Updated booking ${before.invoiceNo}`,
        changes: diff(
          {
            clientName: before.clientName,
            eventDate: before.eventDate,
            eventSlot: before.eventSlot,
            guestCount: before.guestCount,
            hallRent: before.hallRent,
            grandTotal: before.grandTotal,
            status: before.status,
          },
          {
            clientName: data.clientName,
            eventDate: data.eventDate,
            eventSlot: data.eventSlot,
            guestCount: data.guestCount,
            hallRent: data.hallRentPaisa,
            grandTotal: totals.grandTotal,
            status: data.status,
          },
        ),
      });
    });
  } catch (err) {
    if (err instanceof ConflictError) {
      return { error: "This date/slot is no longer available.", conflicts: err.conflicts };
    }
    if (err instanceof ValidationError) return { error: err.message };
    throw err;
  }

  revalidatePath("/bookings");
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/schedule");
  redirect(`/bookings/${bookingId}?updated=1`);
}

// ---------------------------------------------------------------------------
// Cancel booking (spec §9.5)
// A business event, not a deletion. The slot frees immediately; the advance is
// forfeited by default and stays as revenue.
// ---------------------------------------------------------------------------
const cancelSchema = z.object({
  bookingId: z.string().min(1),
  reason: z.string().min(1),
  advanceHandling: z.enum(["forfeit", "refund_partial", "refund_full"]),
  refundAmountPaisa: z.number().int().nonnegative().optional(),
  refundMethod: z.enum(["cash", "bank", "cheque", "easypaisa", "jazzcash"]).optional(),
});

export type CancelBookingInput = z.infer<typeof cancelSchema>;

export async function cancelBooking(input: CancelBookingInput): Promise<ActionOutcome> {
  const user = await requireRole("admin");
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const data = parsed.data;

  const booking = await db.query.bookings.findFirst({ where: eq(bookings.id, data.bookingId) });
  if (!booking || booking.deletedAt) return { error: "Booking not found." };
  if (booking.status === "cancelled") return { error: "This booking is already cancelled." };

  const refund =
    data.advanceHandling === "forfeit"
      ? 0
      : data.advanceHandling === "refund_full"
        ? booking.amountPaid
        : (data.refundAmountPaisa ?? 0);

  if (data.advanceHandling === "refund_partial" && refund <= 0) {
    return { error: "Enter the amount to refund." };
  }
  if (refund > booking.amountPaid) {
    return { error: "Refund cannot exceed what the client has actually paid." };
  }

  await db.transaction(async (tx) => {
    const nowSec = Math.floor(Date.now() / 1000);

    // A refund is a negative payment row, so every existing SUM over payments
    // keeps working without special-casing.
    if (refund > 0) {
      await tx.insert(payments).values({
        id: nanoid(),
        bookingId: data.bookingId,
        receiptNo: await nextReceiptNo(tx),
        amount: -refund,
        method: data.refundMethod ?? "cash",
        paidOn: new Date().toISOString().slice(0, 10),
        notes: "Refund on cancellation",
        recordedBy: user.id,
        createdAt: nowSec,
      });
    }

    const [{ paid }] = await tx
      .select({ paid: sql<number>`COALESCE(SUM(${payments.amount}), 0)` })
      .from(payments)
      .where(and(eq(payments.bookingId, data.bookingId), isNull(payments.deletedAt)));

    await tx
      .update(bookings)
      .set({
        status: "cancelled",
        cancelledAt: nowSec,
        cancelReason: data.reason,
        advanceHandling: data.advanceHandling === "forfeit" ? "forfeit" : "refund",
        refundAmount: refund,
        amountPaid: paid,
        balanceDue: 0, // nothing further is owed once cancelled
        updatedAt: nowSec,
      })
      .where(eq(bookings.id, data.bookingId));

    await audit(tx, {
      userId: user.id,
      action: "cancel",
      module: "booking",
      recordId: data.bookingId,
      summary:
        refund > 0
          ? `Cancelled booking ${booking.invoiceNo} — ${data.reason} (refunded)`
          : `Cancelled booking ${booking.invoiceNo} — ${data.reason} (advance forfeited)`,
    });
  });

  revalidatePath("/bookings");
  revalidatePath(`/bookings/${data.bookingId}`);
  revalidatePath("/schedule");
  return {};
}

// ---------------------------------------------------------------------------
// Delete booking (spec §9.6) — soft, admin only, invoice number never reused.
// ---------------------------------------------------------------------------
export async function deleteBooking(
  bookingId: string,
  typedInvoiceNo: string,
): Promise<ActionOutcome> {
  const user = await requireRole("admin");

  const booking = await db.query.bookings.findFirst({ where: eq(bookings.id, bookingId) });
  if (!booking || booking.deletedAt) return { error: "Booking not found." };

  // Deliberate friction: deleting a large record by reflex should not be easy.
  if ((typedInvoiceNo ?? "").trim() !== (booking.invoiceNo ?? "")) {
    return { error: "The invoice number you typed does not match." };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(bookings)
      .set({ deletedAt: Math.floor(Date.now() / 1000) })
      .where(eq(bookings.id, bookingId));

    await audit(tx, {
      userId: user.id,
      action: "delete",
      module: "booking",
      recordId: bookingId,
      summary: `Deleted booking ${booking.invoiceNo} for ${booking.clientName}`,
    });
  });

  revalidatePath("/bookings");
  revalidatePath("/schedule");
  return {};
}

