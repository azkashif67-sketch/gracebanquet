import { NextResponse, type NextRequest } from "next/server";
import { db } from "./lib/db";

// Local libSQL file access requires the Node.js runtime, not the Edge runtime.
export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/cron).*)"],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const existing = await db.query.users.findFirst({ columns: { id: true } });
  const setupDone = Boolean(existing);

  if (!setupDone && pathname !== "/setup") {
    return NextResponse.redirect(new URL("/setup", request.url));
  }
  if (setupDone && pathname === "/setup") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}
