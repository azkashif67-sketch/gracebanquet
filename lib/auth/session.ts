import "server-only";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { sessions, users } from "../db/schema";

export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "venue_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const SESSION_RENEW_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 15; // renew past halfway

export interface SessionUser {
  id: string;
  username: string;
  fullName: string;
  role: "admin" | "manager" | "staff";
  active: boolean;
  mustChangePassword: boolean;
}

// Lucia-pattern session tokens: a random token is handed to the client as a
// cookie; only its SHA-256 hash is ever stored server-side, so a database
// leak alone can't be used to impersonate a session.
async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(digest).toString("hex");
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

export async function createSession(userId: string): Promise<string> {
  const token = generateToken();
  const id = await hashToken(token);
  const expiresAt = Date.now() + SESSION_DURATION_MS;

  await db.insert(sessions).values({ id, userId, expiresAt });

  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(expiresAt),
    path: "/",
  });

  return token;
}

export async function validateRequest(): Promise<
  { session: { id: string; expiresAt: number }; user: SessionUser } | { session: null; user: null }
> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return { session: null, user: null };

  const sessionId = await hashToken(token);
  const row = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId),
  });
  if (!row) return { session: null, user: null };

  if (row.expiresAt < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return { session: null, user: null };
  }

  const userRow = await db.query.users.findFirst({ where: eq(users.id, row.userId) });
  if (!userRow) return { session: null, user: null };

  // Sliding expiry: renew once past the halfway point of its lifetime.
  if (row.expiresAt - Date.now() < SESSION_RENEW_THRESHOLD_MS) {
    const expiresAt = Date.now() + SESSION_DURATION_MS;
    await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, sessionId));
    store.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: new Date(expiresAt),
      path: "/",
    });
  }

  return {
    session: { id: row.id, expiresAt: row.expiresAt },
    user: {
      id: userRow.id,
      username: userRow.username,
      fullName: userRow.fullName,
      role: userRow.role as SessionUser["role"],
      active: userRow.active === 1,
      mustChangePassword: userRow.mustChangePassword === 1,
    },
  };
}

export async function invalidateSession(sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function invalidateAllUserSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}
