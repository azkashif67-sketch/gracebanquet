import "server-only";
import { and, desc, eq, isNull, lt } from "drizzle-orm";
import { db } from "../index";
import { quotationLines, quotations } from "../schema";

export type QuotationStatus = "draft" | "sent" | "accepted" | "expired" | "declined" | "converted";

export interface QuotationRow {
  id: string;
  quoteNo: string;
  clientName: string;
  eventDatePref: string | null;
  guestCount: number | null;
  grandTotal: number;
  validUntil: string;
  status: string;
  displayStatus: QuotationStatus;
}

function displayStatus(status: string, validUntil: string, today: string): QuotationStatus {
  if (status === "draft" || status === "sent" || status === "accepted" || status === "declined" || status === "converted") {
    // Expired is computed, not stored, for anything still open past its date.
    if ((status === "draft" || status === "sent") && validUntil < today) return "expired";
    return status as QuotationStatus;
  }
  return "expired";
}

export async function listQuotations(): Promise<QuotationRow[]> {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select({
      id: quotations.id,
      quoteNo: quotations.quoteNo,
      clientName: quotations.clientName,
      eventDatePref: quotations.eventDatePref,
      guestCount: quotations.guestCount,
      grandTotal: quotations.grandTotal,
      validUntil: quotations.validUntil,
      status: quotations.status,
    })
    .from(quotations)
    .where(isNull(quotations.deletedAt))
    .orderBy(desc(quotations.createdAt));

  return rows.map((r) => ({ ...r, displayStatus: displayStatus(r.status, r.validUntil, today) }));
}

export async function getQuotationDetail(id: string) {
  const quotation = await db.query.quotations.findFirst({ where: eq(quotations.id, id) });
  if (!quotation) return null;
  const lines = await db
    .select()
    .from(quotationLines)
    .where(eq(quotationLines.quotationId, id))
    .orderBy(quotationLines.sortOrder);

  const today = new Date().toISOString().slice(0, 10);
  return {
    quotation,
    lines,
    displayStatus: displayStatus(quotation.status, quotation.validUntil, today),
  };
}

// Surfaced by the notification centre a few days before expiry.
export async function getExpiringQuotations(withinDays: number) {
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() + withinDays * 86400000).toISOString().slice(0, 10);
  return db
    .select({ id: quotations.id, quoteNo: quotations.quoteNo, validUntil: quotations.validUntil })
    .from(quotations)
    .where(
      and(
        isNull(quotations.deletedAt),
        eq(quotations.status, "sent"),
        lt(quotations.validUntil, cutoff),
      ),
    )
    .then((rows) => rows.filter((r) => r.validUntil >= today));
}
