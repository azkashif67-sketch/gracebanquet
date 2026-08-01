import Link from "next/link";
import { requireAuth } from "@/lib/auth/require-role";
import { getNotificationsForUser } from "@/lib/db/queries/notifications";

const SEVERITY_DOT: Record<string, string> = {
  info: "bg-blue-400",
  warning: "bg-amber-400",
  critical: "bg-red-500",
};

export default async function NotificationsPage() {
  const user = await requireAuth();
  const notifications = await getNotificationsForUser(user.id, 100);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Notifications</h1>
      <div className="flex flex-col rounded-md border">
        {notifications.map((n) => (
          <Link
            key={n.id}
            href={n.link ?? "#"}
            className={`flex gap-2 border-b p-3 text-sm last:border-0 hover:bg-muted ${n.read ? "opacity-60" : ""}`}
          >
            <span className={`mt-1 size-2 shrink-0 rounded-full ${SEVERITY_DOT[n.severity] ?? "bg-muted-foreground"}`} />
            <div>
              <p className="font-medium">{n.title}</p>
              {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
              <p className="text-xs text-muted-foreground">
                {new Date(n.createdAt * 1000).toLocaleString("en-PK")}
              </p>
            </div>
          </Link>
        ))}
        {notifications.length === 0 && (
          <p className="p-4 text-center text-sm text-muted-foreground">No notifications yet.</p>
        )}
      </div>
    </div>
  );
}
