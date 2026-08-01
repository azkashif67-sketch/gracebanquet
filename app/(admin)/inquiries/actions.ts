"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/lib/db";
import { inquiries, inquiryNotes, notifications } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/require-role";
import { audit } from "@/lib/audit";

const inquirySchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().optional(),
  eventType: z.string().optional(),
  preferredDate: z.string().optional(),
  preferredSlot: z.enum(["day", "night"]).optional(),
  guestEstimate: z.number().int().positive().optional(),
  message: z.string().min(1),
});

export type InquiryInput = z.infer<typeof inquirySchema>;

export interface ActionResult {
  error?: string;
}

export async function createInquiry(input: InquiryInput): Promise<ActionResult> {
  const user = await requireRole("admin", "manager", "staff");
  const parsed = inquirySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const data = parsed.data;

  const id = nanoid();
  const nowSec = Math.floor(Date.now() / 1000);
  await db.transaction(async (tx) => {
    await tx.insert(inquiries).values({
      id,
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      eventType: data.eventType || null,
      preferredDate: data.preferredDate || null,
      preferredSlot: data.preferredSlot || null,
      guestEstimate: data.guestEstimate ?? null,
      message: data.message,
      status: "new",
      receivedAt: nowSec,
    });
    await audit(tx, {
      userId: user.id,
      action: "create",
      module: "inquiry",
      recordId: id,
      summary: `Logged inquiry from ${data.name}`,
    });
    // Event-based notification, written inline rather than computed on
    // render (spec §9.12).
    await tx.insert(notifications).values({
      id: nanoid(),
      type: "new_inquiry",
      title: `New inquiry: ${data.name}`,
      body: data.preferredDate ? `Preferred date: ${data.preferredDate}` : undefined,
      link: `/inquiries/${id}`,
      severity: "info",
      entityType: "inquiry",
      entityId: id,
      createdAt: nowSec,
    });
  });

  revalidatePath("/inquiries");
  redirect(`/inquiries/${id}`);
}

export async function markContacted(id: string, followUpDate?: string): Promise<ActionResult> {
  const user = await requireRole("admin", "manager", "staff");
  const before = await db.query.inquiries.findFirst({ where: eq(inquiries.id, id) });
  if (!before) return { error: "Inquiry not found." };

  await db.transaction(async (tx) => {
    await tx
      .update(inquiries)
      .set({ status: "contacted", followUpDate: followUpDate || null })
      .where(eq(inquiries.id, id));
    await audit(tx, {
      userId: user.id,
      action: "update",
      module: "inquiry",
      recordId: id,
      summary: `Marked inquiry from ${before.name} as contacted`,
    });
  });

  revalidatePath(`/inquiries/${id}`);
  return {};
}

export async function addInquiryNote(id: string, note: string): Promise<ActionResult> {
  const user = await requireRole("admin", "manager", "staff");
  if (!note.trim()) return { error: "Note cannot be empty." };

  await db.transaction(async (tx) => {
    await tx.insert(inquiryNotes).values({
      id: nanoid(),
      inquiryId: id,
      note,
      createdBy: user.id,
      createdAt: Math.floor(Date.now() / 1000),
    });
    await audit(tx, {
      userId: user.id,
      action: "update",
      module: "inquiry",
      recordId: id,
      summary: "Added a note",
    });
  });

  revalidatePath(`/inquiries/${id}`);
  return {};
}

const CLOSE_REASONS = ["Not Interested", "Date Unavailable", "Price", "No Response"] as const;
const closeSchema = z.enum(CLOSE_REASONS);

export async function closeInquiry(id: string, reason: string): Promise<ActionResult> {
  const user = await requireRole("admin", "manager", "staff");
  const parsed = closeSchema.safeParse(reason);
  if (!parsed.success) return { error: "Invalid close reason." };

  const before = await db.query.inquiries.findFirst({ where: eq(inquiries.id, id) });
  if (!before) return { error: "Inquiry not found." };

  await db.transaction(async (tx) => {
    await tx.update(inquiries).set({ status: "closed", closeReason: parsed.data }).where(eq(inquiries.id, id));
    await audit(tx, {
      userId: user.id,
      action: "update",
      module: "inquiry",
      recordId: id,
      summary: `Closed inquiry from ${before.name} (${parsed.data})`,
    });
  });

  revalidatePath(`/inquiries/${id}`);
  revalidatePath("/inquiries");
  return {};
}
