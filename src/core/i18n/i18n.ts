/**
 * Localization (FR-051, research R-009).
 *
 * UI chrome resolves through these bundles. Content text (meanings, prompts, NPC lines) is
 * localized INLINE in the content files instead, so adding a vocabulary word stays a one-file
 * edit rather than a three-file one.
 *
 * A missing key renders as a loud marker rather than blank. Silence is the failure mode that
 * ships; a visible marker is the one that gets fixed.
 */
export type Locale = "th" | "en";
export const LOCALES: readonly Locale[] = ["th", "en"];

export type LocaleBundle = Record<string, string>;
export type Bundles = Record<Locale, LocaleBundle>;

export function missingKeyMarker(key: string): string {
  return `⟪missing:${key}⟫`;
}

export interface I18n {
  readonly locale: Locale;
  t(key: string, params?: Record<string, string | number>): string;
  setLocale(locale: Locale): void;
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}

/**
 * Creates an isolated instance. Tests use this so they never share mutable locale state.
 */
export function createI18n(bundles: Bundles, initial: Locale = "th"): I18n {
  let current: Locale = initial;
  return {
    get locale() {
      return current;
    },
    t(key, params) {
      const value = bundles[current][key];
      if (value === undefined) return missingKeyMarker(key);
      return interpolate(value, params);
    },
    setLocale(locale) {
      current = locale;
    },
  };
}

/** Picks the right side of an inline-localized content field. */
export function localize(field: { th: string; en: string }, locale: Locale): string {
  return field[locale];
}
