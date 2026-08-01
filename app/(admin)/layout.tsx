import { requireAuth } from "@/lib/auth/require-role";
import { navItemsForRole } from "@/lib/auth/permissions";
import { Sidebar } from "@/components/nav/sidebar";
import { Header } from "@/components/nav/header";
import { getNotificationsForUser, getUnreadCount } from "@/lib/db/queries/notifications";

// Notifications are only *generated* on dashboard load (spec §9.12) — this
// shared layout wraps every admin page, so calling generateNotifications()
// here (as an earlier version did) reran its dues/quote-expiry checks on
// every single navigation across the whole app, not just the dashboard.
// This layout only reads the already-generated list for the bell.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  const items = navItemsForRole(user.role);

  const [notifications, unreadCount] = await Promise.all([
    getNotificationsForUser(user.id),
    getUnreadCount(user.id),
  ]);

  return (
    <div className="flex min-h-screen flex-1">
      <Sidebar items={items} />
      <div className="flex flex-1 flex-col">
        <Header user={user} notifications={notifications} unreadCount={unreadCount} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
