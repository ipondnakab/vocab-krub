"use client";

import { useMemo } from "react";
import { useGame, useGameDispatch } from "../../runtime/GameContext";
import { createI18n, type Bundles } from "../../core/i18n/i18n";
import th from "../../locales/th.json";
import en from "../../locales/en.json";

const bundles = { th, en } as Bundles;

/**
 * T115. Warnings the player needs to see (FR-055, FR-056).
 *
 * Storage being unavailable is the important one: the game runs perfectly well in private
 * browsing, and a player who is not told will lose an hour of learning without warning. That is
 * worth an unmissable bar, not a console message.
 */
export function NoticeBar() {
  const notice = useGame((s) => s.notice);
  const locale = useGame((s) => s.player.locale);
  const dispatch = useGameDispatch();
  const t = useMemo(() => createI18n(bundles, locale).t, [locale]);

  if (!notice) return null;

  const message =
    notice.kind === "storage-unavailable" ? t("notice.storageUnavailable")
    : notice.kind === "save-unreadable" ? t("notice.saveUnreadable")
    : t("notice.contentError");

  return (
    <div className="notice">
      <div className="panel notice__box">
        <p>{message}</p>
        <button type="button" className="action" onClick={() => dispatch({ type: "dismiss-notice" })}>
          {t("common.close")}
        </button>
      </div>
    </div>
  );
}
