import "server-only";
import { cache } from "react";
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

// Runs on every request, often several times (layout + page + actions all
// call requireAuth/requireRole). React's `cache` dedupes those to a single
// execution per request, and the session+user lookup is one joined query
// rather than two sequential round-trips — at ~90ms each against a remote
// database, that difference is visible on every single navigation.
export const validateRequest = cache(async function validateRequest(): Promise<
  { session: { id: string; expiresAt: number }; user: SessionUser } | { session: null; user: null }
> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return { session: null, user: null };

  const sessionId = await hashToken(token);
  const [row] = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      role: users.role,
      active: users.active,
      mustChangePassword: users.mustChangePassword,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!row) return { session: null, user: null };

  if (row.expiresAt < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return { session: null, user: null };
  }

  // Sliding expiry: renew once past the halfway point of its lifetime. The
  // write isn't awaited — nothing in the response depends on it, and making
  // every request wait on it just to extend a 30-day cookie is wasteful.
  if (row.expiresAt - Date.now() < SESSION_RENEW_THRESHOLD_MS) {
    const expiresAt = Date.now() + SESSION_DURATION_MS;
    void db
      .update(sessions)
      .set({ expiresAt })
      .where(eq(sessions.id, sessionId))
      .catch((err) => console.error("Session renewal failed", err));
    store.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: new Date(expiresAt),
      path: "/",
    });
  }

  return {
    session: { id: row.sessionId, expiresAt: row.expiresAt },
    user: {
      id: row.id,
      username: row.username,
      fullName: row.fullName,
      role: row.role as SessionUser["role"],
      active: row.active === 1,
      mustChangePassword: row.mustChangePassword === 1,
    },
  };
});

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
