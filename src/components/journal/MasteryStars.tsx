"use client";

const STAR_COUNT = 5;

/**
 * T081. Five stars, filled in proportion to mastery.
 *
 * These stay art rather than CSS (asset contract § 7) because they carry the game's visual
 * identity at the one moment that matters most: a word reaching 100% and being restored.
 */
export function MasteryStars({ percent, size = 16 }: { percent: number; size?: number }) {
  const filled = Math.round(percent * STAR_COUNT);
  return (
    <span className="stars" role="img" aria-label={`${Math.round(percent * 100)}%`}>
      {Array.from({ length: STAR_COUNT }, (_, i) => (
        <img
          key={i}
          data-pixel
          width={size}
          height={size}
          alt=""
          src={`/assets/placeholder/ui/star-${i < filled ? "filled" : "empty"}.png`}
        />
      ))}
    </span>
  );
}
