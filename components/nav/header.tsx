import { logout } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import type { SessionUser } from "@/lib/auth/session";

export function Header({ user }: { user: SessionUser }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
      <div />
      <div className="flex items-center gap-3">
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
