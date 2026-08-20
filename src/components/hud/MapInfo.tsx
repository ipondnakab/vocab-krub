"use client";

import { useMemo } from "react";
import { useContent, useGame } from "../../runtime/GameContext";
import { buildMinimapMarkers, mapDisplayName } from "../../core/world/minimap";
import { chapterOfMap } from "../../core/chapter/progression";
import { createI18n, localize, type Bundles } from "../../core/i18n/i18n";
import th from "../../locales/th.json";
import en from "../../locales/en.json";

const bundles = { th, en } as Bundles;

/**
 * T024, T026. The map's name, its chapter's title, and what remains — beside the minimap SVG,
 * never inside it, so Thai combining marks render through the DOM (research R-014 of feature 001).
 */
export function MapInfo() {
  const screen = useGame((s) => s.screen);
  const minimapOpen = useGame((s) => s.minimapOpen);
  const world = useGame((s) => s.world);
  const player = useGame((s) => s.player);
  const content = useContent();
  const t = useMemo(() => createI18n(bundles, player.locale).t, [player.locale]);

  if (screen !== "world" || !minimapOpen || !world) return null;

  const mapName = mapDisplayName(world.map.id, content);
  const chapter = chapterOfMap(world.map.id, content);
  const markers = buildMinimapMarkers(world, player, content);

  return (
    <div className="mapinfo panel">
      <div className="mapinfo__name">{localize(mapName, player.locale)}</div>
      {chapter && <div className="mapinfo__chapter">{localize(chapter.title, player.locale)}</div>}
      <div className="mapinfo__remaining">
        <span>
          {t("minimap.monstersRemaining")} {markers.monstersRemaining}
        </span>
        <span>
          {t("minimap.lessonsRemaining")} {markers.lessonsRemaining}
        </span>
      </div>
    </div>
  );
}
