import Phaser from "phaser";
import { PLACEHOLDER_ROOT, REAL_ROOT, monsterSheet, type SpriteSheetSpec } from "../assets";
import type { GameStore } from "../../runtime/GameStore";

/**
 * Loads art, preferring the owner's real files and falling back to generated placeholders.
 *
 * The fallback is what makes the asset contract's promise real: drop a conforming file at
 * `public/assets/monsters/monster-go.png` and it is used, with no code change and no registry
 * to update.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("Preload");
  }

  preload(): void {
    const store = this.registry.get("store") as GameStore;
    const monsterId = store.getSnapshot().battle?.monsterId;

    const specs: SpriteSheetSpec[] = monsterId ? [monsterSheet(monsterId)] : [];

    // A missing real file is expected, not an error — swap in the placeholder and carry on.
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      const spec = specs.find((s) => s.key === file.key);
      // Phaser types file.url as string | object; only the string form is a path we set.
      const url = typeof file.url === "string" ? file.url : "";
      if (!spec || url.startsWith(PLACEHOLDER_ROOT)) return;
      this.load.spritesheet(spec.key, `${PLACEHOLDER_ROOT}/${spec.path}`, {
        frameWidth: spec.frameWidth,
        frameHeight: spec.frameHeight,
      });
    });

    for (const spec of specs) {
      this.load.spritesheet(spec.key, `${REAL_ROOT}/${spec.path}`, {
        frameWidth: spec.frameWidth,
        frameHeight: spec.frameHeight,
      });
    }
  }

  create(): void {
    const store = this.registry.get("store") as GameStore;
    const state = store.getSnapshot();
    if (state.battle) {
      this.scene.start("Battle");
      return;
    }
    // The world map arrives asynchronously; Boot holds the screen until it does.
    if (state.world) {
      this.scene.start("World");
      return;
    }
    this.scene.start("Boot");
    const unsubscribe = store.subscribe(() => {
      const next = store.getSnapshot();
      if (next.battle) { unsubscribe(); this.scene.start("Battle"); }
      else if (next.world) { unsubscribe(); this.scene.start("World"); }
    });
  }
}
