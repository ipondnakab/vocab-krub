import { describe, expect, it } from "vitest";
import { CHARACTER_COLUMNS, CHARACTER_ROWS, MONSTER_FRAMES, WALK_FPS } from "../../src/phaser/assets";

/**
 * The sprite-sheet frame maths (contracts/asset-contract.md § 2, § 3).
 *
 * Pure arithmetic over the contract's constants, so it is Node-testable even though the scene
 * that uses it is not. It guards the row order: swap `left` and `right` and a player walking
 * east would face west, which is the kind of bug that looks like an art problem for an hour.
 *
 * Verified against the live scene: walking right cycled frames 8,9,10,11 at 8 fps and settled
 * on 8 when stopped — exactly what the numbers below predict.
 */
const walkFrames = (facing: keyof typeof CHARACTER_ROWS): number[] => {
  const start = CHARACTER_ROWS[facing] * CHARACTER_COLUMNS;
  return Array.from({ length: CHARACTER_COLUMNS }, (_, i) => start + i);
};

describe("character sheet frame maths", () => {
  it("orders rows down, left, right, up", () => {
    expect(CHARACTER_ROWS).toEqual({ down: 0, left: 1, right: 2, up: 3 });
  });

  it("maps each facing to its four contiguous frames", () => {
    expect(walkFrames("down")).toEqual([0, 1, 2, 3]);
    expect(walkFrames("left")).toEqual([4, 5, 6, 7]);
    expect(walkFrames("right")).toEqual([8, 9, 10, 11]);
    expect(walkFrames("up")).toEqual([12, 13, 14, 15]);
  });

  it("uses the first frame of a row as that direction's idle pose", () => {
    for (const facing of ["down", "left", "right", "up"] as const) {
      expect(walkFrames(facing)[0]).toBe(CHARACTER_ROWS[facing] * CHARACTER_COLUMNS);
    }
  });

  it("covers all 16 frames with no overlap between directions", () => {
    const all = (["down", "left", "right", "up"] as const).flatMap(walkFrames);
    expect(all).toHaveLength(16);
    expect(new Set(all).size).toBe(16);
  });

  it("walks at the contracted frame rate", () => {
    expect(WALK_FPS).toBe(8);
  });
});

describe("monster frame order", () => {
  it("puts RESTORED last — a freed word, not a corpse (Principle I)", () => {
    expect(MONSTER_FRAMES).toEqual({ idle: 0, hurt: 1, attack: 2, restored: 3 });
  });
});
