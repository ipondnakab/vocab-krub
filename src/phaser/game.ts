import Phaser from "phaser";
import { BattleScene } from "./scenes/BattleScene";
import { BootScene } from "./scenes/BootScene";
import { PreloadScene } from "./scenes/PreloadScene";
import type { GameStore } from "../runtime/GameStore";

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

/**
 * What the mounting component is given back.
 *
 * Deliberately NOT `Phaser.Game`. The layering lint rule caught `GameCanvas` type-importing
 * Phaser just to type a ref, and the rule was right: a component that names a Phaser type is
 * coupled to Phaser, type-only or not. An interface we own keeps the boundary absolute and
 * means swapping the renderer touches this file alone.
 */
export interface PhaserGameHandle {
  destroy(): void;
}

/**
 * Creates the Phaser instance.
 *
 * Called only from a client component behind `next/dynamic({ ssr: false })` — Phaser reads
 * `window` at module scope, so any import path reaching a server component breaks the build
 * (research R-013).
 */
export function createPhaserGame(parent: HTMLElement, store: GameStore): PhaserGameHandle {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: "#14101f",
    // Nearest-neighbour scaling: pixel art must never be smoothed.
    pixelArt: true,
    roundPixels: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [PreloadScene, BootScene, BattleScene],
  });

  // Scenes read the store from the registry rather than importing it, which keeps them free of
  // module-level singletons and testable in isolation later.
  game.registry.set("store", store);

  return { destroy: () => game.destroy(true) };
}
