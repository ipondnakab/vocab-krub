"use client";

import { useMemo } from "react";
import { useContent, useGame } from "../../runtime/GameContext";
import { buildMinimapMarkers, buildMinimapTerrain } from "../../core/world/minimap";
import type { Direction } from "../../content/schemas/index";

/**
 * T015, T016, T022, T027. The corner minimap (contracts/minimap-model.md).
 *
 * Inline SVG over the derived model — no measurement, colour, or filtering happens here that
 * the contract says belongs in core. `viewBox` is set to the map's own tile dimensions and only
 * `aspect-ratio` constrains the box, so the shape holds without stretching (FR-005, R-305)
 * regardless of how large a hand-authored map turns out to be.
 *
 * Terrain is memoized on map id (plan.md § Performance Goals): the patrol tick fires every
 * 900ms and must not recompute 300 collision lookups for a picture that has not changed.
 */

const FACING_DEGREES: Record<Direction, number> = { up: 0, right: 90, down: 180, left: 270 };

export function Minimap() {
  const screen = useGame((s) => s.screen);
  const minimapOpen = useGame((s) => s.minimapOpen);
  const world = useGame((s) => s.world);
  const player = useGame((s) => s.player);
  const content = useContent();

  // Keyed on map identity rather than the map object, so a monster patrolling every 900ms does
  // not recompute 300 collision lookups for terrain that has not changed (plan.md § Performance).
  const map = world?.map;
  const terrain = useMemo(() => (map ? buildMinimapTerrain(map) : null), [map?.id]);

  if (screen !== "world" || !minimapOpen || !world || !terrain) return null;

  const markers = buildMinimapMarkers(world, player, content);
  const { width, height } = terrain;

  return (
    <div className="minimap">
      <svg
        className="minimap__svg"
        viewBox={`0 0 ${width} ${height}`}
        style={{ aspectRatio: `${width} / ${height}` }}
        role="img"
        aria-label="Minimap"
      >
        <rect className="minimap__ground" x={0} y={0} width={width} height={height} />
        {terrain.blocked.map((isBlocked, i) => {
          if (!isBlocked) return null;
          const x = i % width;
          const y = Math.floor(i / width);
          return <rect key={`b${i}`} className="minimap__blocked" x={x} y={y} width={1} height={1} />;
        })}
        {terrain.exits.map((exit, i) => (
          <rect
            key={`e${i}`}
            className="minimap__exit"
            x={exit.x + 0.15}
            y={exit.y + 0.15}
            width={0.7}
            height={0.7}
          />
        ))}
        {markers.monsters.map((m) => (
          <rect
            key={m.monsterId}
            className="minimap__monster"
            x={m.x + 0.2}
            y={m.y + 0.2}
            width={0.6}
            height={0.6}
            transform={`rotate(45, ${m.x + 0.5}, ${m.y + 0.5})`}
          />
        ))}
        {markers.npcs.map((n) => (
          <circle
            key={n.npcId}
            className={`minimap__npc minimap__npc--${n.lesson}`}
            cx={n.x + 0.5}
            cy={n.y + 0.5}
            r={0.3}
          />
        ))}
        <path
          className="minimap__player"
          d="M0,-0.35 L0.3,0.25 L-0.3,0.25 Z"
          transform={`translate(${markers.player.x + 0.5}, ${markers.player.y + 0.5}) rotate(${FACING_DEGREES[markers.player.facing]})`}
        />
      </svg>
    </div>
  );
}
