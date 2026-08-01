import { logout } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import type { SessionUser } from "@/lib/auth/session";
import { NotificationBell } from "@/components/notifications/notification-bell";
import type { NotificationRow } from "@/lib/db/queries/notifications";

export function Header({
  user,
  notifications,
  unreadCount,
}: {
  user: SessionUser;
  notifications: NotificationRow[];
  unreadCount: number;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
      <div />
      <div className="flex items-center gap-3">
        <NotificationBell notifications={notifications} unreadCount={unreadCount} />
        <span className="text-sm text-muted-foreground">
          {user.fullName} · <span className="capitalize">{user.role}</span>
        </span>
        <form action={logout}>
          <Button type="submit" variant="outline" size="sm">
            Log out
          </Button>
        </form>
      </div>
    </header>
  );
}
