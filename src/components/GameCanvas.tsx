"use client";

import { useEffect, useRef } from "react";
import type { GameStore } from "../runtime/GameStore";
import { createPhaserGame, type PhaserGameHandle } from "../phaser/game";

/**
 * T044. Mounts Phaser into the DOM.
 *
 * This is the ONLY component allowed to touch Phaser, and it is loaded through
 * `next/dynamic({ ssr: false })` because Phaser reads `window` at module scope (research R-013).
 *
 * The ref guard is not defensive clutter: React Strict Mode double-invokes effects in
 * development, and without it you get two Phaser instances fighting over one canvas — the
 * classic way this integration breaks, and it looks like a rendering bug rather than a
 * lifecycle one.
 */
export function GameCanvas({ store }: { store: GameStore }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<PhaserGameHandle | null>(null);

  useEffect(() => {
    const parent = parentRef.current;
    if (!parent || gameRef.current) return;

    gameRef.current = createPhaserGame(parent, store);

    return () => {
      gameRef.current?.destroy();
      gameRef.current = null;
    };
  }, [store]);

  return <div ref={parentRef} className="stage__canvas" />;
}
