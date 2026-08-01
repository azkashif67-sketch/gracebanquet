import "server-only";
import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../index";
import { notificationReads, notifications } from "../schema";
import { formatPKR } from "../../calculations";
import { getDuesAlerts } from "./bookings";
import { getExpiringQuotations } from "./quotations";

type Severity = "info" | "warning" | "critical";

interface NotificationDraft {
  type: string;
  title: string;
  body?: string;
  link?: string;
  severity: Severity;
  entityType: string;
  entityId: string;
}

function startOfTodayEpoch(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

async function upsertOnce(draft: NotificationDraft): Promise<void> {
  const todayStart = startOfTodayEpoch();
  const existing = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.type, draft.type),
        eq(notifications.entityType, draft.entityType),
        eq(notifications.entityId, draft.entityId),
        gte(notifications.createdAt, todayStart),
      ),
    )
    .limit(1);
  if (existing.length > 0) return;

  await db.insert(notifications).values({
    id: nanoid(),
    type: draft.type,
    title: draft.title,
    body: draft.body ?? null,
    link: draft.link ?? null,
    severity: draft.severity,
    entityType: draft.entityType,
    entityId: draft.entityId,
    createdAt: Math.floor(Date.now() / 1000),
  });
}

// Time-based notifications are computed on render (dashboard load / panel
// open) and deduplicated per day, rather than pushed by a cron — spec §9.12.
// Event-based ones (new_inquiry) are written inline where they happen
// instead (see app/(admin)/inquiries/actions.ts).
export async function generateNotifications(): Promise<void> {
  const [dues, expiringQuotes] = await Promise.all([getDuesAlerts(), getExpiringQuotations(3)]);

  for (const b of dues.overdue) {
    await upsertOnce({
      type: "overdue",
      title: `Overdue: ${b.invoiceNo ?? b.clientName}`,
      body: `${b.clientName} — ${formatPKR(b.balanceDue)} overdue`,
      link: `/bookings/${b.id}`,
      severity: "critical",
      entityType: "booking",
      entityId: b.id,
    });
  }
  for (const b of dues.dueSoon) {
    await upsertOnce({
      type: "due_soon",
      title: `Due soon: ${b.invoiceNo ?? b.clientName}`,
      body: `${b.clientName} — ${formatPKR(b.balanceDue)} due ${b.dueDate}`,
      link: `/bookings/${b.id}`,
      severity: "warning",
      entityType: "booking",
      entityId: b.id,
    });
  }
  for (const b of dues.eventTomorrow) {
    await upsertOnce({
      type: "event_tomorrow",
      title: `Event tomorrow: ${b.clientName}`,
      body: b.balanceDue > 0 ? `${formatPKR(b.balanceDue)} still pending` : undefined,
      link: `/bookings/${b.id}`,
      severity: "warning",
      entityType: "booking",
      entityId: b.id,
    });
  }
  for (const b of dues.expiringHolds) {
    await upsertOnce({
      type: "hold_expiring",
      title: `Hold expiring: ${b.clientName}`,
      link: `/bookings/${b.id}`,
      severity: "warning",
      entityType: "booking",
      entityId: b.id,
    });
  }
  for (const q of expiringQuotes) {
    await upsertOnce({
      type: "quote_expiring",
      title: `Quote ${q.quoteNo} expiring soon`,
      body: `Valid until ${q.validUntil}`,
      link: `/quotations/${q.id}`,
      severity: "warning",
      entityType: "quotation",
      entityId: q.id,
    });
  }
}

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  severity: string;
  createdAt: number;
  read: boolean;
}

export async function getNotificationsForUser(userId: string, limit = 30): Promise<NotificationRow[]> {
  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      body: notifications.body,
      link: notifications.link,
      severity: notifications.severity,
      createdAt: notifications.createdAt,
      readAt: notificationReads.readAt,
    })
    .from(notifications)
    .leftJoin(
      notificationReads,
      and(eq(notificationReads.notificationId, notifications.id), eq(notificationReads.userId, userId)),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  return rows.map((r) => ({ ...r, read: r.readAt !== null }));
}

export async function getUnreadCount(userId: string): Promise<number> {
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .leftJoin(
      notificationReads,
      and(eq(notificationReads.notificationId, notifications.id), eq(notificationReads.userId, userId)),
    )
    .where(isNull(notificationReads.readAt));
  return rows.length;
}
