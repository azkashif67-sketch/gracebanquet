import "server-only";
import { and, desc, eq, isNull, like, or } from "drizzle-orm";
import { db } from "../index";
import { inquiries, inquiryNotes } from "../schema";

export interface InquiryFilters {
  search?: string;
  status?: string;
}

export async function listInquiries(filters: InquiryFilters = {}) {
  return db
    .select()
    .from(inquiries)
    .where(
      and(
        isNull(inquiries.deletedAt),
        filters.status ? eq(inquiries.status, filters.status) : undefined,
        filters.search
          ? or(like(inquiries.name, `%${filters.search}%`), like(inquiries.phone, `%${filters.search}%`))
          : undefined,
      ),
    )
    .orderBy(desc(inquiries.receivedAt));
}

export async function getInquiryDetail(id: string) {
  const inquiry = await db.query.inquiries.findFirst({ where: eq(inquiries.id, id) });
  if (!inquiry) return null;
  const notes = await db
    .select()
    .from(inquiryNotes)
    .where(eq(inquiryNotes.inquiryId, id))
    .orderBy(desc(inquiryNotes.createdAt));
  return { inquiry, notes };
}

export async function countNewInquiries(): Promise<number> {
  const rows = await db
    .select({ id: inquiries.id })
    .from(inquiries)
    .where(and(eq(inquiries.status, "new"), isNull(inquiries.deletedAt)));
  return rows.length;
}
