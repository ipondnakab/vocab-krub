import { defineConfig } from "vitest/config";

/**
 * T005. Node environment on purpose: no jsdom, no happy-dom, no browser.
 *
 * Constitution Principle V exempts rendering from testing, and research R-012 records why:
 * every assertion worth making about a battle is available against `src/core/` in
 * microseconds. If a test needs a browser to pass, the logic it covers is in the wrong
 * layer — move it into `src/core/`.
 *
 * SC-007 caps this suite at 30 seconds. That budget only survives if it stays Node-only.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      include: ["src/core/**"],
      reporter: ["text", "html"],
    },
  },
  resolve: {
    alias: {
      "@/core": new URL("./src/core", import.meta.url).pathname,
      "@/runtime": new URL("./src/runtime", import.meta.url).pathname,
      "@/content": new URL("./src/content", import.meta.url).pathname,
      "@/platform": new URL("./src/platform", import.meta.url).pathname,
      "@/locales": new URL("./src/locales", import.meta.url).pathname,
    },
  },
});
