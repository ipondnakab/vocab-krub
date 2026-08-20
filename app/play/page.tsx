import { Suspense } from "react";
import { GameClient } from "../../src/components/GameClient";

/**
 * The game route.
 *
 * Server component. Everything below it is client-only — Phaser cannot be evaluated during SSR
 * (research R-013). Suspense is required because GameClient reads search params for the dev
 * shortcuts.
 */
export default function PlayPage() {
  return (
    <main style={{ height: "100dvh" }}>
      <Suspense fallback={null}>
        <GameClient />
      </Suspense>
    </main>
  );
}
