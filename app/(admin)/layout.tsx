import { requireAuth } from "@/lib/auth/require-role";
import { navItemsForRole } from "@/lib/auth/permissions";
import { Sidebar } from "@/components/nav/sidebar";
import { Header } from "@/components/nav/header";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  const items = navItemsForRole(user.role);

  return (
    <div className="flex min-h-screen flex-1">
      <Sidebar items={items} />
      <div className="flex flex-1 flex-col">
        <Header user={user} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
