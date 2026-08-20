import { describe, expect, it } from "vitest";
import th from "../../src/locales/th.json" with { type: "json" };
import en from "../../src/locales/en.json" with { type: "json" };

/**
 * SC-009 / FR-051 — both bundles must be 100% complete.
 *
 * A key present in one locale and missing in the other renders as ⟪missing:…⟫ for exactly the
 * players who speak that language, which is the failure mode most likely to reach production
 * unnoticed. This test is the gate.
 */
describe("locale bundles", () => {
  const thKeys = Object.keys(th).sort();
  const enKeys = Object.keys(en).sort();

  it("have identical key sets", () => {
    expect(thKeys.filter((k) => !enKeys.includes(k))).toEqual([]);
    expect(enKeys.filter((k) => !thKeys.includes(k))).toEqual([]);
  });

  it("have no empty values", () => {
    for (const [locale, bundle] of [["th", th], ["en", en]] as const) {
      for (const [key, value] of Object.entries(bundle)) {
        expect(typeof value, `${locale}.${key}`).toBe("string");
        expect(value.trim().length, `${locale}.${key} is empty`).toBeGreaterThan(0);
      }
    }
  });

  it("use the same interpolation placeholders in both locales", () => {
    // "Dealt {amount} damage" must not become "สร้างความเสียหาย {value}" — the parameter would
    // silently never substitute for Thai players.
    const placeholders = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort();
    for (const key of thKeys) {
      const thVal = (th as Record<string, string>)[key]!;
      const enVal = (en as Record<string, string>)[key]!;
      expect(placeholders(thVal), `placeholders differ for '${key}'`).toEqual(placeholders(enVal));
    }
  });

  it("actually contain Thai script in the Thai bundle", () => {
    // Guards against an untranslated bundle copied wholesale from English.
    // Language endonyms are exempt: a switcher shows each language in its OWN script, so "EN"
    // stays "EN" in the Thai bundle. Listed by name so nothing else can hide behind it.
    const ENDONYMS = new Set(["common.localeEndonymEn", "common.localeEndonymTh"]);
    const thaiPattern = /[฀-๿]/;
    const untranslated = thKeys
      .filter((k) => !ENDONYMS.has(k))
      .filter((k) => !thaiPattern.test((th as Record<string, string>)[k]!));
    expect(untranslated, `these Thai entries contain no Thai script: ${untranslated.join(", ")}`).toEqual([]);
  });
});
