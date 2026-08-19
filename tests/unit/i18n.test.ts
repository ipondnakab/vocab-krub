import { describe, expect, it } from "vitest";
import { createI18n, localize, missingKeyMarker, type Bundles } from "../../src/core/i18n/i18n.js";

const bundles: Bundles = {
  th: { "battle.attack": "โจมตี", "battle.damage": "สร้างความเสียหาย {amount}" },
  en: { "battle.attack": "Attack", "battle.damage": "Dealt {amount} damage" },
};

describe("i18n (FR-051)", () => {
  it("resolves keys in the active locale", () => {
    const i18n = createI18n(bundles, "th");
    expect(i18n.t("battle.attack")).toBe("โจมตี");
    i18n.setLocale("en");
    expect(i18n.t("battle.attack")).toBe("Attack");
  });

  it("interpolates parameters", () => {
    expect(createI18n(bundles, "en").t("battle.damage", { amount: 30 })).toBe("Dealt 30 damage");
  });

  it("renders a LOUD marker for a missing key, never blank", () => {
    // Blank text ships unnoticed; ⟪missing:…⟫ does not. FR-051.
    expect(createI18n(bundles, "th").t("nope.missing")).toBe(missingKeyMarker("nope.missing"));
    expect(createI18n(bundles, "th").t("nope.missing")).toContain("nope.missing");
  });

  it("leaves an unknown placeholder intact rather than printing undefined", () => {
    expect(createI18n(bundles, "en").t("battle.damage", { other: 1 })).toBe("Dealt {amount} damage");
  });

  it("gives each instance isolated locale state", () => {
    const a = createI18n(bundles, "th");
    const b = createI18n(bundles, "th");
    a.setLocale("en");
    expect(b.locale).toBe("th");
  });

  it("localize() picks the right side of an inline-localized content field", () => {
    const meaning = { th: "ไป", en: "to go" };
    expect(localize(meaning, "th")).toBe("ไป");
    expect(localize(meaning, "en")).toBe("to go");
  });
});
