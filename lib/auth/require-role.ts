import "server-only";
import { redirect } from "next/navigation";
import { invalidateSession } from "./session";
import { validateRequest } from "./session";
import type { SessionUser } from "./session";

export type Role = "admin" | "manager" | "staff";

export class ForbiddenError extends Error {
  constructor() {
    super("FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

// Every Server Action and protected page calls this first. There is no other
// layer of protection (no row-level security beneath the app) — see spec §3.3.
export async function requireRole(...allowed: Role[]): Promise<SessionUser> {
  const user = await requireAuth();
  if (!allowed.includes(user.role)) {
    throw new ForbiddenError();
  }
  return user;
}

// For pages/layouts that just need to know who's signed in (any role),
// without gating on a specific role list.
export async function requireAuth(): Promise<SessionUser> {
  const { session, user } = await validateRequest();
  if (!session || !user) redirect("/login");
  if (!user.active) {
    await invalidateSession(session.id);
    redirect("/login");
  }
  // A temporary password must actually be changed — otherwise the redirect
  // issued at login is bypassed by simply typing any other URL.
  if (user.mustChangePassword) {
    redirect("/account/change-password");
  }
  return user;
}
