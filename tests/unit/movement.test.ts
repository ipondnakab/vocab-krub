import { describe, expect, it } from "vitest";
import { attemptMove, facingTile, isInBounds, resolveDirection, type Walkable } from "../../src/core/world/movement";

/** 5x5 room, walled border, with one interior obstacle at (2,2). */
const room: Walkable = {
  width: 5,
  height: 5,
  collidesAt: (x, y) => x === 0 || y === 0 || x === 4 || y === 4 || (x === 2 && y === 2),
};

describe("movement (FR-030)", () => {
  it("moves in all four directions", () => {
    const centre = { x: 2, y: 3 };
    expect(attemptMove(centre, "left", room)).toMatchObject({ x: 1, y: 3, moved: true });
    expect(attemptMove(centre, "right", room)).toMatchObject({ x: 3, y: 3, moved: true });
    expect(attemptMove({ x: 1, y: 2 }, "up", room)).toMatchObject({ x: 1, y: 1, moved: true });
    expect(attemptMove({ x: 1, y: 1 }, "down", room)).toMatchObject({ x: 1, y: 2, moved: true });
  });

  it("is blocked by a colliding tile and does NOT end inside it", () => {
    // The stuck-in-wall edge case: a blocked move must leave the player exactly where they were.
    const result = attemptMove({ x: 2, y: 3 }, "up", room);
    expect(result.moved).toBe(false);
    expect(result).toMatchObject({ x: 2, y: 3 });
    expect(room.collidesAt(result.x, result.y)).toBe(false);
  });

  it("is blocked by the map boundary", () => {
    const edge: Walkable = { width: 3, height: 3, collidesAt: () => false };
    expect(attemptMove({ x: 0, y: 0 }, "left", edge)).toMatchObject({ x: 0, y: 0, moved: false });
    expect(attemptMove({ x: 0, y: 0 }, "up", edge)).toMatchObject({ x: 0, y: 0, moved: false });
    expect(attemptMove({ x: 2, y: 2 }, "right", edge)).toMatchObject({ x: 2, y: 2, moved: false });
    expect(attemptMove({ x: 2, y: 2 }, "down", edge)).toMatchObject({ x: 2, y: 2, moved: false });
  });

  it("still TURNS toward an obstacle it could not enter", () => {
    // How every JRPG behaves, and what makes "face an NPC to talk" feel natural.
    expect(attemptMove({ x: 2, y: 3 }, "up", room).facing).toBe("up");
  });

  it("never lands on a colliding tile from any position or direction", () => {
    for (let x = 1; x < 4; x += 1) {
      for (let y = 1; y < 4; y += 1) {
        if (room.collidesAt(x, y)) continue;
        for (const direction of ["up", "down", "left", "right"] as const) {
          const result = attemptMove({ x, y }, direction, room);
          expect(room.collidesAt(result.x, result.y), `${x},${y} ${direction}`).toBe(false);
          expect(isInBounds(result.x, result.y, room)).toBe(true);
        }
      }
    }
  });

  it("reports the tile the player is looking at", () => {
    expect(facingTile({ x: 2, y: 2 }, "up")).toEqual({ x: 2, y: 1 });
    expect(facingTile({ x: 2, y: 2 }, "right")).toEqual({ x: 3, y: 2 });
  });
});

describe("diagonal input", () => {
  it("resolves simultaneous presses to a single axis", () => {
    expect(resolveDirection(["up", "right"])).toBe("up");
    expect(resolveDirection(["right", "down"])).toBe("down");
    expect(resolveDirection(["left"])).toBe("left");
  });

  it("returns null when nothing is pressed", () => {
    expect(resolveDirection([])).toBeNull();
  });
});
