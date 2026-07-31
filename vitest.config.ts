import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
    // Server-only modules (checked via the "server-only" package) resolve to
    // its no-op stub under this condition, same as Next's RSC build — without
    // it, importing lib/db/operations.ts (and anything that re-exports it)
    // throws outside of Next's bundler. Vitest's Node test environment runs
    // module resolution through the SSR resolver, so it must be set there too.
    conditions: ["react-server"],
  },
  ssr: {
    resolve: {
      conditions: ["react-server"],
    },
  },
});
