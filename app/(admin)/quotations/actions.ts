"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/lib/db";
import { inquiries, quotationLines, quotations, taxes } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/require-role";
import { audit } from "@/lib/audit";
import { calculateTotals } from "@/lib/calculations";
import { nextQuoteNo } from "@/lib/db/operations";
import { getVenueSettings } from "@/lib/db/queries/settings";

const lineSchema = z.object({
  kind: z.enum(["service", "extra"]),
  serviceId: z.string().optional(),
  label: z.string().min(1),
  qty: z.number().positive(),
  ratePaisa: z.number().int(),
  taxable: z.boolean(),
});

const quotationSchema = z.object({
  clientName: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().optional(),
  eventType: z.string().optional(),
  eventDatePref: z.string().optional(),
  eventSlotPref: z.enum(["day", "night"]).optional(),
  hallPref: z.string().optional(),
  guestCount: z.number().int().positive().optional(),
  lines: z.array(lineSchema),
  discountAmountPaisa: z.number().int().nonnegative(),
  taxIds: z.array(z.string()),
  validUntil: z.string().min(1),
  notes: z.string().optional(),
  sourceInquiryId: z.string().optional(),
});

export type QuotationInput = z.infer<typeof quotationSchema>;

export interface ActionResult {
  error?: string;
  id?: string;
}

export async function createQuotation(input: QuotationInput): Promise<ActionResult> {
  const user = await requireRole("admin", "manager");
  const parsed = quotationSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const data = parsed.data;

  const venueSettings = await getVenueSettings();
  const selectedTaxes = data.taxIds.length
    ? await db.select().from(taxes).where(inArray(taxes.id, data.taxIds))
    : [];

  const serviceLines = data.lines.filter((l) => l.kind === "service");
  const extraLines = data.lines.filter((l) => l.kind === "extra");
  const totals = calculateTotals({
    serviceLines: serviceLines.map((l) => ({ qty: l.qty, rate: l.ratePaisa, taxable: l.taxable })),
    extraLines: extraLines.map((l) => ({ qty: l.qty, rate: l.ratePaisa, taxable: l.taxable })),
    discountAmount: data.discountAmountPaisa,
    taxes: selectedTaxes.map((t) => ({ id: t.id, name: t.name, rateBps: t.rate })),
    taxOnDiscounted: venueSettings.taxOnDiscounted,
  });

  const id = nanoid();
  const nowSec = Math.floor(Date.now() / 1000);

  await db.transaction(async (tx) => {
    const quoteNo = await nextQuoteNo(tx);

    await tx.insert(quotations).values({
      id,
      quoteNo,
      clientName: data.clientName,
      phone: data.phone,
      email: data.email || null,
      eventType: data.eventType || null,
      eventDatePref: data.eventDatePref || null,
      eventSlotPref: data.eventSlotPref || null,
      hallPref: data.hallPref || null,
      guestCount: data.guestCount ?? null,
      subtotal: totals.subtotal,
      discountAmount: totals.discount,
      taxAmount: totals.taxAmount,
      grandTotal: totals.grandTotal,
      validUntil: data.validUntil,
      status: "draft",
      notes: data.notes || null,
      createdBy: user.id,
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    if (data.lines.length) {
      await tx.insert(quotationLines).values(
        data.lines.map((l, i) => ({
          id: nanoid(),
          quotationId: id,
          kind: l.kind,
          serviceId: l.serviceId || null,
          label: l.label,
          qty: l.qty,
          rate: l.ratePaisa,
          lineTotal: l.qty * l.ratePaisa,
          taxable: l.taxable ? 1 : 0,
          sortOrder: i,
        })),
      );
    }

    await audit(tx, {
      userId: user.id,
      action: "create",
      module: "quotation",
      recordId: id,
      summary: `Created quotation ${quoteNo} for ${data.clientName}`,
    });

    if (data.sourceInquiryId) {
      await tx.update(inquiries).set({ status: "converted" }).where(eq(inquiries.id, data.sourceInquiryId));
      await audit(tx, {
        userId: user.id,
        action: "update",
        module: "inquiry",
        recordId: data.sourceInquiryId,
        summary: `Converted to quotation ${quoteNo}`,
      });
    }
  });

  revalidatePath("/quotations");
  redirect(`/quotations/${id}`);
}

const statusSchema = z.enum(["sent", "accepted", "declined"]);

export async function setQuotationStatus(id: string, status: z.infer<typeof statusSchema>): Promise<ActionResult> {
  const user = await requireRole("admin", "manager");
  const parsed = statusSchema.safeParse(status);
  if (!parsed.success) return { error: "Invalid status." };

  const before = await db.query.quotations.findFirst({ where: eq(quotations.id, id) });
  if (!before) return { error: "Quotation not found." };

  await db.transaction(async (tx) => {
    await tx
      .update(quotations)
      .set({ status: parsed.data, updatedAt: Math.floor(Date.now() / 1000) })
      .where(eq(quotations.id, id));
    await audit(tx, {
      userId: user.id,
      action: "update",
      module: "quotation",
      recordId: id,
      summary: `Marked quotation ${before.quoteNo} as ${parsed.data}`,
    });
  });

  revalidatePath(`/quotations/${id}`);
  revalidatePath("/quotations");
  return {};
}

export async function deleteQuotation(id: string): Promise<ActionResult> {
  const user = await requireRole("admin", "manager");
  const before = await db.query.quotations.findFirst({ where: eq(quotations.id, id) });
  if (!before) return { error: "Quotation not found." };

  await db.transaction(async (tx) => {
    await tx
      .update(quotations)
      .set({ deletedAt: Math.floor(Date.now() / 1000) })
      .where(eq(quotations.id, id));
    await audit(tx, {
      userId: user.id,
      action: "delete",
      module: "quotation",
      recordId: id,
      summary: `Deleted quotation ${before.quoteNo}`,
    });
  });

  revalidatePath("/quotations");
  return {};
}

