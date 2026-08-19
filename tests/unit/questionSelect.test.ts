import { describe, expect, it } from "vitest";
import { NoEligibleQuestionError, eligibleQuestions, selectQuestion } from "../../src/core/questions/select";
import { initMastery, markEncountered, recordAnswer } from "../../src/core/mastery/mastery";
import { balance, content, player, rng } from "../helpers/fixtures";
import type { PlayerState } from "../../src/core/player/playerState";

const BOSS = "monster-go";

function input(p: PlayerState, over: Partial<Parameters<typeof selectQuestion>[0]> = {}) {
  return {
    monsterId: BOSS, player: p, content, balance, rng: rng(7),
    askedQuestionIds: [] as string[], lastQuestionId: null as string | null, ...over,
  };
}

/** Draws many questions, re-seeding each time, to measure the distribution. */
function draw(p: PlayerState, over: Parameters<typeof input>[1] = {}, n = 400): string[] {
  return Array.from({ length: n }, (_, i) =>
    selectQuestion(input(p, { rng: rng(i + 1), ...over })).id,
  );
}

describe("selection — grammar gating (FR-018)", () => {
  it("excludes questions whose grammar the player has not learned", () => {
    const beginner = player({ grammarLearned: [] });
    const ids = new Set(draw(beginner));
    for (const id of ids) expect(content.question(id).requiresGrammar).toBeNull();
  });

  it("includes them once the grammar is learned", () => {
    const ids = new Set(draw(player({ grammarLearned: ["past-simple"] })));
    expect([...ids].some((id) => content.question(id).requiresGrammar === "past-simple")).toBe(true);
  });

  it("throws a NAMED error rather than returning undefined when nothing is eligible", () => {
    // Every go question either requires grammar or is ungated; strip the ungated ones by
    // pretending the player knows nothing and the pool still has ungated entries — so instead
    // force the true empty case with a monster whose questions all require unlearned grammar.
    const gated = player({ grammarLearned: [] });
    const pools = eligibleQuestions(input(gated));
    expect(pools.monsterPool.length).toBeGreaterThan(0); // sanity: ungated questions exist

    expect(() =>
      selectQuestion({
        ...input(gated),
        content: {
          ...content,
          monster: () => ({ ...content.monster(BOSS), questionPoolIds: ["q-go-past"] }),
        },
      }),
    ).toThrow(NoEligibleQuestionError);
  });
});

describe("selection — repetition (FR-013)", () => {
  it("never returns the question just asked", () => {
    const p = player();
    for (const id of draw(p, { lastQuestionId: "q-go-past" })) expect(id).not.toBe("q-go-past");
  });

  it("prefers unasked questions while any remain", () => {
    const p = player();
    const asked = ["q-go-meaning", "q-go-recognition", "q-go-base", "q-go-past"];
    const counts = draw(p, { askedQuestionIds: asked }, 600);
    const unaskedShare = counts.filter((id) => !asked.includes(id)).length / counts.length;
    // Down-weighted by recencyPenalty (0.2), not excluded.
    expect(unaskedShare).toBeGreaterThan(0.7);
  });

  it("degrades gracefully when every question has been asked", () => {
    // A monster whose pool is smaller than the battle is long must keep asking something.
    const p = player();
    const all = content.monster(BOSS).questionPoolIds;
    expect(() => selectQuestion(input(p, { askedQuestionIds: all }))).not.toThrow();
  });
});

describe("selection — mastery bias (FR-019)", () => {
  it("prefers unmastered components of the monster's word", () => {
    let mastery = markEncountered(initMastery(content.word("go")));
    // Master `meaning` outright; everything else stays unmastered.
    mastery = recordAnswer(mastery, "meaning", true, balance);
    mastery = recordAnswer(mastery, "meaning", true, balance);
    expect(mastery.components["meaning"]?.mastered).toBe(true);

    const p = player({ mastery: { go: mastery } });
    const ids = draw(p, {}, 600);
    const meaningShare = ids.filter((id) => content.question(id).component === "meaning").length / ids.length;

    // 7 go questions; `meaning` weighted 1 against 3 for the rest → well under an even 1/7.
    expect(meaningShare).toBeLessThan(1 / 7);
  });
});

describe("selection — review pool (FR-020)", () => {
  it("falls back to the monster's word when nothing has been encountered yet", () => {
    const ids = new Set(draw(player()));
    for (const id of ids) expect(content.question(id).wordId).toBe("go");
  });

  it("draws review questions from previously encountered words", () => {
    const p = player({
      mastery: {
        eat: markEncountered(initMastery(content.word("eat"))),
        see: markEncountered(initMastery(content.word("see"))),
      },
    });
    const ids = draw(p, {}, 600);
    const reviewShare = ids.filter((id) => content.question(id).wordId !== "go").length / ids.length;
    expect(reviewShare).toBeGreaterThan(0.15);
    expect(reviewShare).toBeLessThan(0.5);
  });

  it("honours reviewProportion as the ONLY knob controlling the ratio", () => {
    const p = player({ mastery: { eat: markEncountered(initMastery(content.word("eat"))) } });
    const heavy = { ...balance, questions: { ...balance.questions, reviewProportion: 0.8 } };
    const ids = Array.from({ length: 600 }, (_, i) =>
      selectQuestion(input(p, { rng: rng(i + 1), balance: heavy })).id,
    );
    const reviewShare = ids.filter((id) => content.question(id).wordId !== "go").length / ids.length;
    expect(reviewShare).toBeGreaterThan(0.65);
  });

  it("never treats the monster's own word as review", () => {
    const p = player({ mastery: { go: markEncountered(initMastery(content.word("go"))) } });
    expect(eligibleQuestions(input(p)).reviewPool).toEqual([]);
  });
});
