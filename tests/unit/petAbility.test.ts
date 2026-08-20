import { describe, expect, it } from "vitest";
import { createBattle, dismissFeedback, submitAnswer, usePetAbility, type BattleState } from "../../src/core/battle/battle";
import { effectSchema } from "../../src/content/schemas";
import { balance, content, deps, player } from "../helpers/fixtures";
import type { PlayerState } from "../../src/core/player/playerState";

const withOwl = (over: Partial<PlayerState> = {}): PlayerState =>
  player({
    inventory: [{ itemId: "owl", quantity: 1 }],
    equipped: { weapon: null, armor: null, pet: "owl" },
    ...over,
  });

const start = (p: PlayerState = withOwl(), monsterId = "monster-go", seed = 5): BattleState =>
  createBattle({ monsterId, player: p, content, balance, rng: deps(seed).rng });

describe("pet ability (FR-042)", () => {
  it("gives the equipped pet its configured uses, and none without one", () => {
    expect(start().petUsesRemaining).toBe(1);
    expect(start(player()).petUsesRemaining).toBe(0);
  });

  it("removes exactly ONE option", () => {
    const before = start();
    const after = usePetAbility(before, deps());
    expect(after.eliminatedIndices).toHaveLength(1);
  });

  it("NEVER removes the correct answer", () => {
    // Constitution Principle IV: the pet narrows the field. It does not answer.
    for (let seed = 1; seed <= 40; seed += 1) {
      const before = start(withOwl(), "monster-go", seed);
      const after = usePetAbility(before, deps(seed));
      expect(after.eliminatedIndices).not.toContain(before.currentQuestion!.correctIndex);
    }
  });

  it("always leaves the correct answer selectable", () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const after = usePetAbility(start(withOwl(), "monster-go", seed), deps(seed));
      const remaining = after.currentQuestion!.options
        .map((_, i) => i)
        .filter((i) => !after.eliminatedIndices.includes(i));
      expect(remaining).toContain(after.currentQuestion!.correctIndex);
      // At least two options always stand, so knowing something is still required.
      expect(remaining.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("consumes a use and refuses once the budget is spent", () => {
    const after = usePetAbility(start(), deps());
    expect(after.petUsesRemaining).toBe(0);
    expect(() => usePetAbility(after, deps())).toThrow(/No pet ability uses remaining/);
  });

  it("resets the budget for the NEXT battle", () => {
    const first = usePetAbility(start(), deps());
    expect(first.petUsesRemaining).toBe(0);
    const second = start(first.player);
    expect(second.petUsesRemaining).toBe(1);
  });

  it("clears eliminated options when a new question is drawn", () => {
    // A fresh question means a fresh set of options; last turn's removal must not carry over.
    const used = usePetAbility(start(), deps());
    expect(used.eliminatedIndices).toHaveLength(1);
    const next = submitAnswer(used, used.currentQuestion!.correctIndex, deps()).state;
    expect(next.eliminatedIndices).toEqual([]);
  });

  it("throws outside the answering phase", () => {
    const s = start();
    const showing = submitAnswer(s, (s.currentQuestion!.correctIndex + 1) % 4, deps()).state;
    expect(() => usePetAbility(showing, deps())).toThrow(/phase is 'showing-feedback'/);
  });
});

describe("first-mistake-free (FR-041)", () => {
  const withRobe = (): PlayerState =>
    player({
      inventory: [{ itemId: "scholar-robe", quantity: 1 }],
      equipped: { weapon: null, armor: "scholar-robe", pet: null },
      grammarLearned: ["present-simple", "past-simple"],
    });

  it("absorbs the first grammar miss, then stops", () => {
    let s = createBattle({ monsterId: "monster-go", player: withRobe(), content, balance, rng: deps(11).rng });
    const hpStart = s.player.hp;

    // Miss until we hit a grammar-dependent question, which is what the robe covers.
    let absorbed = false;
    for (let i = 0; i < 8 && !absorbed; i += 1) {
      if (s.phase !== "awaiting-answer") { s = dismissFeedback(s, deps(11)).state; continue; }
      const gated = s.currentQuestion!.requiresGrammar !== null;
      const r = submitAnswer(s, (s.currentQuestion!.correctIndex + 1) % 4, deps(11));
      s = r.state;
      if (gated) { expect(s.pendingMonsterDamage).toBe(0); absorbed = true; }
      s = dismissFeedback(s, deps(11)).state;
    }
    expect(absorbed).toBe(true);
    expect(s.firstMistakeUsed).toBe(true);
    expect(s.player.hp).toBeLessThanOrEqual(hpStart);
  });

  it("still SHOWS the correct answer — it softens the cost, never hides the mistake", () => {
    let s = createBattle({ monsterId: "monster-go", player: withRobe(), content, balance, rng: deps(11).rng });
    while (s.currentQuestion!.requiresGrammar === null) {
      s = submitAnswer(s, s.currentQuestion!.correctIndex, deps(11)).state;
    }
    const r = submitAnswer(s, (s.currentQuestion!.correctIndex + 1) % 4, deps(11));
    expect(r.feedback).not.toBeNull();
    expect(r.correct).toBe(false);
    // Mastery still records a miss. Forgiveness is about HP, not about the truth.
    expect(r.masteryEvents[0]?.correct).toBe(false);
  });
});

describe("PRINCIPLE IV GUARD — no effect may answer a question (FR-043)", () => {
  /**
   * T093. This test exists to FAIL if someone later adds an answer-revealing effect.
   *
   * Constitution Principle IV: "Equipment, pets, and items MAY reduce the cost of being wrong,
   * grant hints, or improve rewards. They MUST NEVER answer a question for the player." The
   * Effect union is closed precisely so that promise is checkable rather than aspirational.
   */
  const ALLOWED_EFFECT_KINDS = [
    "damage-multiplier",
    "damage-reduction",
    "first-mistake-free",
    "reveal-wrong-option",
    "xp-bonus",
  ] as const;

  it("enumerates every effect kind the schema permits", () => {
    const kinds = effectSchema.options.map((option) => option.shape.kind.value as string).sort();
    expect(kinds).toEqual([...ALLOWED_EFFECT_KINDS].sort());
  });

  it("has no effect kind that could select, submit, or skip an answer", () => {
    // If a variant like `auto-answer`, `reveal-correct`, or `skip-question` is ever added, the
    // list above will not match and this suite fails loudly — which is the entire point.
    const forbidden = /answer|correct|solve|skip|auto|reveal-correct/i;
    for (const kind of ALLOWED_EFFECT_KINDS) {
      if (kind === "reveal-wrong-option") continue; // reveals a WRONG option; asserted above
      expect(kind, `effect kind '${kind}' sounds like it answers questions`).not.toMatch(forbidden);
    }
  });

  it("confirms every SHIPPED item uses only permitted effects", () => {
    for (const item of content.items) {
      for (const effect of item.effects) {
        expect(ALLOWED_EFFECT_KINDS, `${item.id} uses '${effect.kind}'`).toContain(effect.kind);
      }
    }
  });

  it("proves no shipped item shortens a battle by skipping a turn", () => {
    // Every effect either scales a number or removes one wrong option. None advance the turn.
    for (const item of content.items) {
      for (const effect of item.effects) {
        expect(effect.kind).not.toBe("skip-question");
        if (effect.kind === "reveal-wrong-option") expect(effect.usesPerBattle).toBeLessThanOrEqual(2);
      }
    }
  });
});
