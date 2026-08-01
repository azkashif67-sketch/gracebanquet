"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { notificationReads, notifications } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/require-role";

export async function markNotificationRead(id: string): Promise<void> {
  const user = await requireAuth();
  await db
    .insert(notificationReads)
    .values({ notificationId: id, userId: user.id, readAt: Math.floor(Date.now() / 1000) })
    .onConflictDoNothing();
  revalidatePath("/notifications");
}

export async function markAllNotificationsRead(): Promise<void> {
  const user = await requireAuth();
  const all = await db.select({ id: notifications.id }).from(notifications);
  const nowSec = Math.floor(Date.now() / 1000);
  if (all.length > 0) {
    await db
      .insert(notificationReads)
      .values(all.map((n) => ({ notificationId: n.id, userId: user.id, readAt: nowSec })))
      .onConflictDoNothing();
  }
  revalidatePath("/notifications");
}
