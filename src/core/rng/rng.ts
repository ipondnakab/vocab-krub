/**
 * Seeded, deterministic randomness (research R-007).
 *
 * Question selection, option shuffling, flee resolution, and item drops are all random AND all
 * change player state, so Principle V requires them to be tested. A test seeds this and asserts
 * exact outcomes; production seeds it from the clock. It also makes any reported bug
 * reproducible from its seed.
 *
 * `Math.random` is banned inside src/core by lint precisely so this stays true.
 */
export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
  /** Uniform element. Throws on an empty array rather than returning undefined. */
  pick<T>(items: readonly T[]): T;
  /** Fisher-Yates copy. Does not mutate the input. */
  shuffle<T>(items: readonly T[]): T[];
}

/** mulberry32 — small, fast, and good enough for gameplay. Not cryptographic. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (maxExclusive: number): number => {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new Error(`Rng.int requires a positive integer bound, received ${maxExclusive}`);
    }
    return Math.floor(next() * maxExclusive);
  };

  return {
    next,
    int,
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error("Rng.pick called with an empty array");
      return items[int(items.length)] as T;
    },
    shuffle<T>(items: readonly T[]): T[] {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = int(i + 1);
        const a = copy[i] as T;
        const b = copy[j] as T;
        copy[i] = b;
        copy[j] = a;
      }
      return copy;
    },
  };
}
