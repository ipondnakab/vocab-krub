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
      /**
       * T124 / SC-006. Thresholds so coverage cannot quietly regress.
       *
       * Set just below the current numbers rather than at 100%: the remaining gaps are
       * defensive throws and validation branches that are genuinely unreachable from valid
       * content (the migration path with only one save version, the "no eligible question"
       * error that content validation now prevents). Chasing those to 100% would mean writing
       * tests that assert nothing about behaviour.
       *
       * What IS at 100% line coverage is every module that changes player state: battle,
       * mastery, progression. That is what SC-006 actually asks for.
       */
      thresholds: {
        statements: 90,
        branches: 78,
        functions: 95,
        lines: 92,
      },
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
