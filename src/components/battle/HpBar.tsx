"use client";

/**
 * T048. HP bar in CSS, not art — the asset contract no longer asks anyone to draw this.
 *
 * The fill transitions rather than jumping. A bar that snaps between values reads as a
 * spreadsheet updating; a bar that drains reads as a hit landing.
 */
export function HpBar({
  label, hp, maxHp, variant,
}: {
  label: string;
  hp: number;
  maxHp: number;
  variant: "player" | "monster";
}) {
  const pct = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;
  return (
    <div className="hpbar">
      <div className="hpbar__row">
        <span className="label">{label}</span>
        <span className="hpbar__value">
          {Math.max(0, hp)} / {maxHp}
        </span>
      </div>
      <div
        className="hpbar__track"
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.max(0, hp)}
        aria-valuemin={0}
        aria-valuemax={maxHp}
      >
        <div className={`hpbar__fill hpbar__fill--${variant}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
