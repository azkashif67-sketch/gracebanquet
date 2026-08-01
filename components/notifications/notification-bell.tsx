"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { markAllNotificationsRead, markNotificationRead } from "@/app/(admin)/notifications/actions";
import type { NotificationRow } from "@/lib/db/queries/notifications";

const SEVERITY_DOT: Record<string, string> = {
  info: "bg-blue-400",
  warning: "bg-amber-400",
  critical: "bg-red-500",
};

export function NotificationBell({
  notifications,
  unreadCount,
}: {
  notifications: NotificationRow[];
  unreadCount: number;
}) {
  const router = useRouter();

  async function handleOpenNotification(n: NotificationRow) {
    if (!n.read) {
      await markNotificationRead(n.id);
      router.refresh();
    }
  }

  async function handleMarkAll() {
    await markAllNotificationsRead();
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="relative">
            🔔
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b p-2">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleMarkAll}>
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 && (
            <p className="p-4 text-center text-sm text-muted-foreground">No notifications.</p>
          )}
          {notifications.map((n) => (
            <Link
              key={n.id}
              href={n.link ?? "#"}
              onClick={() => handleOpenNotification(n)}
              className={`flex gap-2 border-b p-3 text-sm last:border-0 hover:bg-muted ${n.read ? "opacity-60" : ""}`}
            >
              <span className={`mt-1 size-2 shrink-0 rounded-full ${SEVERITY_DOT[n.severity] ?? "bg-muted-foreground"}`} />
              <div>
                <p className="font-medium">{n.title}</p>
                {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
              </div>
            </Link>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
