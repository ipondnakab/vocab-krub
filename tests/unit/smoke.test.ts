import { describe, expect, it } from "vitest";

/**
 * T011 — Harness smoke test.
 *
 * These assertions are not filler. Each one guards a property the rest of the test strategy
 * depends on, and each would fail loudly if the config drifted.
 */
describe("test harness", () => {
  it("runs in a Node environment with no DOM", () => {
    // Research R-012 and SC-007: the suite is Node-only, which is the only reason 100%
    // coverage of state-changing rules can complete in under 30 seconds. If a DOM appears
    // here, someone added jsdom and the budget is about to break.
    expect(typeof globalThis.window).toBe("undefined");
    expect(typeof globalThis.document).toBe("undefined");
    expect(typeof globalThis.localStorage).toBe("undefined");
  });

  it("runs on a Node version that supports the project's tooling", () => {
    const major = Number(process.versions.node.split(".")[0]);
    expect(major).toBeGreaterThanOrEqual(24);
  });
});
