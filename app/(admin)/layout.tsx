import { requireAuth } from "@/lib/auth/require-role";
import { navItemsForRole } from "@/lib/auth/permissions";
import { Sidebar } from "@/components/nav/sidebar";
import { Header } from "@/components/nav/header";
import {
  generateNotifications,
  getNotificationsForUser,
  getUnreadCount,
} from "@/lib/db/queries/notifications";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  const items = navItemsForRole(user.role);

  // Dues/quote-expiry alerts are money-related and only meaningful for
  // Admin/Manager to generate; Staff still see whatever already exists
  // (e.g. new_inquiry, which is written inline elsewhere).
  if (user.role === "admin" || user.role === "manager") {
    await generateNotifications();
  }
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
