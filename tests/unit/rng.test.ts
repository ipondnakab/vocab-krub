import { describe, expect, it } from "vitest";
import { createRng } from "../../src/core/rng/rng";

describe("seeded Rng (research R-007)", () => {
  it("produces an identical sequence for the same seed", () => {
    // This is what makes selection, shuffling, flee, and drops testable at all.
    const a = createRng(12345);
    const b = createRng(12345);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = Array.from({ length: 10 }, (_, i) => createRng(1).next() + i * 0);
    const b = Array.from({ length: 10 }, (_, i) => createRng(2).next() + i * 0);
    expect(a[0]).not.toBe(b[0]);
  });

  it("stays within [0, 1)", () => {
    const rng = createRng(7);
    for (let i = 0; i < 5000; i += 1) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("int() stays within [0, maxExclusive)", () => {
    const rng = createRng(99);
    for (let i = 0; i < 5000; i += 1) {
      const v = rng.int(4);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(4);
    }
  });

  it("int() rejects a non-positive or non-integer bound", () => {
    const rng = createRng(1);
    expect(() => rng.int(0)).toThrow();
    expect(() => rng.int(-3)).toThrow();
    expect(() => rng.int(2.5)).toThrow();
  });

  it("pick() eventually covers every element", () => {
    const rng = createRng(2024);
    const items = ["a", "b", "c", "d"];
    const seen = new Set(Array.from({ length: 400 }, () => rng.pick(items)));
    expect(seen.size).toBe(items.length);
  });

  it("pick() throws on an empty array rather than returning undefined", () => {
    expect(() => createRng(1).pick([])).toThrow(/empty/);
  });

  it("shuffle() preserves every element and does not mutate the input", () => {
    const rng = createRng(555);
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const frozen = [...input];
    const out = rng.shuffle(input);
    expect(input).toEqual(frozen);
    expect([...out].sort((x, y) => x - y)).toEqual(frozen);
  });

  it("shuffle() actually reorders", () => {
    const input = Array.from({ length: 12 }, (_, i) => i);
    const out = createRng(31337).shuffle(input);
    expect(out).not.toEqual(input);
  });
});
