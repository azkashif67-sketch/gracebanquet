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

const draftKey = (d: Pick<NotificationDraft, "type" | "entityType" | "entityId">) =>
  `${d.type}:${d.entityType}:${d.entityId}`;

// Time-based notifications are computed on render (dashboard load / panel
// open) and deduplicated per day, rather than pushed by a cron — spec §9.12.
// Event-based ones (new_inquiry) are written inline where they happen
// instead (see app/(admin)/inquiries/actions.ts).
//
// This runs on every admin/manager page load (see app/(admin)/layout.tsx),
// so it must stay to a small, fixed number of round-trips regardless of how
// many candidate notifications there are — one read of today's existing
// rows, then one batched insert. The original version issued a SELECT (and
// often an INSERT) per candidate inside a sequential loop, which turned
// every page view into dozens of round-trips against the remote Turso
// connection and was the main cause of the app feeling slow.
export async function generateNotifications(): Promise<void> {
  const [dues, expiringQuotes] = await Promise.all([getDuesAlerts(), getExpiringQuotations(3)]);

  const drafts: NotificationDraft[] = [
    ...dues.overdue.map((b) => ({
      type: "overdue",
      title: `Overdue: ${b.invoiceNo ?? b.clientName}`,
      body: `${b.clientName} — ${formatPKR(b.balanceDue)} overdue`,
      link: `/bookings/${b.id}`,
      severity: "critical" as const,
      entityType: "booking",
      entityId: b.id,
    })),
    ...dues.dueSoon.map((b) => ({
      type: "due_soon",
      title: `Due soon: ${b.invoiceNo ?? b.clientName}`,
      body: `${b.clientName} — ${formatPKR(b.balanceDue)} due ${b.dueDate}`,
      link: `/bookings/${b.id}`,
      severity: "warning" as const,
      entityType: "booking",
      entityId: b.id,
    })),
    ...dues.eventTomorrow.map((b) => ({
      type: "event_tomorrow",
      title: `Event tomorrow: ${b.clientName}`,
      body: b.balanceDue > 0 ? `${formatPKR(b.balanceDue)} still pending` : undefined,
      link: `/bookings/${b.id}`,
      severity: "warning" as const,
      entityType: "booking",
      entityId: b.id,
    })),
    ...dues.expiringHolds.map((b) => ({
      type: "hold_expiring",
      title: `Hold expiring: ${b.clientName}`,
      link: `/bookings/${b.id}`,
      severity: "warning" as const,
      entityType: "booking",
      entityId: b.id,
    })),
    ...expiringQuotes.map((q) => ({
      type: "quote_expiring",
      title: `Quote ${q.quoteNo} expiring soon`,
      body: `Valid until ${q.validUntil}`,
      link: `/quotations/${q.id}`,
      severity: "warning" as const,
      entityType: "quotation",
      entityId: q.id,
    })),
  ];

  if (drafts.length === 0) return;

  const todayStart = startOfTodayEpoch();
  const existingToday = await db
    .select({ type: notifications.type, entityType: notifications.entityType, entityId: notifications.entityId })
    .from(notifications)
    .where(gte(notifications.createdAt, todayStart));
  const existingKeys = new Set(existingToday.map((n) => draftKey({ type: n.type, entityType: n.entityType ?? "", entityId: n.entityId ?? "" })));

  const toInsert = drafts.filter((d) => !existingKeys.has(draftKey(d)));
  if (toInsert.length === 0) return;

  const nowSec = Math.floor(Date.now() / 1000);
  await db.insert(notifications).values(
    toInsert.map((d) => ({
      id: nanoid(),
      type: d.type,
      title: d.title,
      body: d.body ?? null,
      link: d.link ?? null,
      severity: d.severity,
      entityType: d.entityType,
      entityId: d.entityId,
      createdAt: nowSec,
    })),
  );
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
