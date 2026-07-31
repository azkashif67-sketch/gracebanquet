import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Middleware needs the Node.js runtime (not Edge) to talk to the local
  // libSQL file / @libsql/client. Declared per-middleware via
  // `export const config = { runtime: "nodejs" }` in middleware.ts — this
  // Next.js version no longer gates that behind an experimental flag.
};

export default nextConfig;
