import { describe, expect, it } from "vitest";
import {
  attemptFlee, createBattle, dismissFeedback, endBattle, submitAnswer,
  type BattleState, type BattleTurnResult,
} from "../../src/core/battle/battle";
import { balance, content, deps, player, scriptedRng } from "../helpers/fixtures";
import type { PlayerState } from "../../src/core/player/playerState";

const BOSS = "monster-go";
const MOB = "monster-eat";

function start(monsterId = BOSS, p: PlayerState = player(), seed = 5): BattleState {
  return createBattle({ monsterId, player: p, content, balance, rng: deps(seed).rng });
}

const correctIndex = (s: BattleState) => s.currentQuestion!.correctIndex;
const wrongIndex = (s: BattleState) => (s.currentQuestion!.correctIndex + 1) % 4;

/** Answers correctly, resolving feedback if the turn produced any. */
function answerRight(s: BattleState, d = deps()): BattleTurnResult {
  return submitAnswer(s, correctIndex(s), d);
}
function answerWrong(s: BattleState, d = deps()): BattleTurnResult {
  return submitAnswer(s, wrongIndex(s), d);
}

describe("battle setup", () => {
  it("opens with both combatants at full HP and a question ready (US1 scenario 1)", () => {
    const s = start();
    expect(s.monsterHp).toBe(s.monsterMaxHp);
    expect(s.player.hp).toBe(s.player.maxHp);
    expect(s.currentQuestion).not.toBeNull();
    expect(s.phase).toBe("awaiting-answer");
    expect(s.turn).toBe(1);
  });

  it("marks the monster's word encountered, entering it into the review pool", () => {
    expect(start().player.mastery["go"]?.encountered).toBe(true);
  });
});

describe("correct answer (FR-002)", () => {
  it("damages the monster and the monster does NOT attack that turn", () => {
    const s = start();
    const hpBefore = s.player.hp;
    const r = answerRight(s);
    expect(r.correct).toBe(true);
    expect(r.damageDealt).toBeGreaterThan(0);
    expect(r.state.monsterHp).toBe(s.monsterHp - r.damageDealt);
    expect(r.damageTaken).toBe(0);
    expect(r.state.player.hp).toBe(hpBefore);
  });

  it("deals exactly the damage configured for the question's difficulty", () => {
    const s = start();
    const expected = balance.damage.byDifficulty[s.currentQuestion!.difficulty];
    expect(answerRight(s).damageDealt).toBe(expected);
  });

  it("draws a new question and continues while the monster lives (FR-007, US1 scenario 4)", () => {
    const r = answerRight(start());
    expect(r.outcome).toBeNull();
    expect(r.state.phase).toBe("awaiting-answer");
    expect(r.state.currentQuestion).not.toBeNull();
    expect(r.state.turn).toBe(2);
  });

  it("shows no feedback panel on a correct answer", () => {
    expect(answerRight(start()).feedback).toBeNull();
  });
});

describe("wrong answer (FR-003, FR-004)", () => {
  it("deals NO damage to the monster", () => {
    const s = start();
    const r = answerWrong(s);
    expect(r.correct).toBe(false);
    expect(r.damageDealt).toBe(0);
    expect(r.state.monsterHp).toBe(s.monsterHp);
  });

  it("teaches BEFORE the counterattack — feedback arrives with HP untouched", () => {
    // FR-004 and US1 scenario 3: the correct answer and explanation are shown, and only after
    // dismissal does the monster attack. Enforced by the state machine, not by UI politeness.
    const s = start();
    const r = answerWrong(s);

    expect(r.feedback).not.toBeNull();
    expect(r.feedback!.correctOption).toBe(s.currentQuestion!.options[s.currentQuestion!.correctIndex]);
    expect(r.feedback!.explanation.th.length).toBeGreaterThan(0);
    expect(r.feedback!.explanation.en.length).toBeGreaterThan(0);
    expect(r.damageTaken).toBe(0);
    expect(r.state.player.hp).toBe(s.player.hp); // not hit yet
    expect(r.state.phase).toBe("showing-feedback");
  });

  it("lands the counterattack only once feedback is dismissed", () => {
    const s = start();
    const shown = answerWrong(s).state;
    const r = dismissFeedback(shown, deps());

    expect(r.damageTaken).toBe(content.monster(BOSS).attack);
    expect(r.state.player.hp).toBe(s.player.hp - r.damageTaken);
    expect(r.state.phase).toBe("awaiting-answer");
  });

  it("reduces the counterattack by equipped armor and never below zero", () => {
    const armored = player({ equipped: { weapon: null, armor: "beginner-armor", pet: null } });
    const s = start(BOSS, armored);
    const r = dismissFeedback(answerWrong(s).state, deps());
    expect(r.damageTaken).toBe(content.monster(BOSS).attack - 4);
    expect(r.damageTaken).toBeGreaterThan(0);
  });
});

describe("victory and defeat (FR-008, FR-009)", () => {
  it("wins when monster HP reaches EXACTLY zero", () => {
    const s: BattleState = { ...start(), monsterHp: balance.damage.byDifficulty[start().currentQuestion!.difficulty] };
    const fresh = start();
    const exact: BattleState = { ...fresh, monsterHp: balance.damage.byDifficulty[fresh.currentQuestion!.difficulty] };
    const r = answerRight(exact);
    expect(r.state.monsterHp).toBe(0);
    expect(r.outcome).toBe("victory");
    expect(s.monsterHp).toBeGreaterThan(0); // sanity on the fixture
  });

  it("never lets monster HP go negative", () => {
    const nearly: BattleState = { ...start(), monsterHp: 1 };
    expect(answerRight(nearly).state.monsterHp).toBe(0);
  });

  it("loses when player HP reaches EXACTLY zero", () => {
    const attack = content.monster(BOSS).attack;
    const frail = player({ hp: attack });
    const s = start(BOSS, frail);
    const r = dismissFeedback(answerWrong(s).state, deps());
    expect(r.state.player.hp).toBe(0);
    expect(r.outcome).toBe("defeat");
  });

  it("never lets player HP go negative", () => {
    const frail = player({ hp: 1 });
    const r = dismissFeedback(answerWrong(start(BOSS, frail)).state, deps());
    expect(r.state.player.hp).toBe(0);
  });

  it("asks no further question once an outcome is decided (US1 scenario 5)", () => {
    const fresh = start();
    const exact: BattleState = { ...fresh, monsterHp: 1 };
    const won = answerRight(exact).state;
    expect(won.currentQuestion).toBeNull();
    expect(won.phase).toBe("ended");
  });

  it("cannot end with both sides at zero, because only one side acts per turn", () => {
    // The mutual-kill edge case is impossible by construction rather than by tie-break.
    const fresh = start();
    const knifeEdge: BattleState = { ...fresh, monsterHp: 1, player: { ...fresh.player, hp: 1 } };
    const win = answerRight(knifeEdge);
    expect(win.state.monsterHp).toBe(0);
    expect(win.state.player.hp).toBe(1);

    const loss = dismissFeedback(answerWrong(knifeEdge).state, deps());
    expect(loss.state.player.hp).toBe(0);
    expect(loss.state.monsterHp).toBe(1);
  });
});

describe("input locking (FR-010)", () => {
  it("throws if an answer arrives while feedback is showing", () => {
    const shown = answerWrong(start()).state;
    expect(() => submitAnswer(shown, 0, deps())).toThrow(/phase is 'showing-feedback'/);
  });

  it("throws if an answer arrives after the battle ended", () => {
    const fresh = start();
    const won = answerRight({ ...fresh, monsterHp: 1 }).state;
    expect(() => submitAnswer(won, 0, deps())).toThrow(/phase is 'ended'/);
  });

  it("throws if feedback is dismissed when none is showing", () => {
    expect(() => dismissFeedback(start(), deps())).toThrow(/phase is 'awaiting-answer'/);
  });
});

describe("flee (FR-011, FR-012)", () => {
  const alwaysEscape = () => ({ ...deps(), rng: scriptedRng([0]) });
  const neverEscape = () => ({ ...deps(), rng: scriptedRng([0.99]) });

  it("escapes when the roll beats the configured chance", () => {
    const r = attemptFlee(start(MOB), alwaysEscape());
    expect(r.escaped).toBe(true);
    expect(r.state.outcome).toBe("fled");
    expect(r.state.phase).toBe("ended");
  });

  it("costs the turn on failure and lets the monster hit", () => {
    const s = start(MOB);
    const r = attemptFlee(s, neverEscape());
    expect(r.escaped).toBe(false);
    expect(r.state.player.hp).toBeLessThan(s.player.hp);
    expect(r.state.turn).toBe(2);
  });

  it("THROWS on a boss rather than quietly failing (FR-012)", () => {
    // Offering the option at all is the bug, so this surfaces in development.
    expect(() => attemptFlee(start(BOSS), alwaysEscape())).toThrow(/Cannot flee boss/);
  });

  it("keeps mastery earned before fleeing", () => {
    const s = answerRight(start(MOB)).state;
    const earned = s.player.mastery["eat"];
    const fled = attemptFlee(s, alwaysEscape()).state;
    expect(fled.player.mastery["eat"]).toEqual(earned);
  });

  it("awards nothing on escape — outcome is neither victory nor defeat", () => {
    expect(attemptFlee(start(MOB), alwaysEscape()).state.outcome).toBe("fled");
  });
});

describe("mastery wiring (FR-027)", () => {
  it("records mastery on EVERY answer, right or wrong", () => {
    const s = start();
    const component = s.currentQuestion!.component;
    const r = answerRight(s);
    expect(r.masteryEvents).toHaveLength(1);
    expect(r.masteryEvents[0]).toMatchObject({ wordId: "go", componentId: component, correct: true });
    expect(r.state.player.mastery["go"]?.components[component]?.attempts).toBe(1);
  });

  it("applies mastery PER ANSWER, not at battle end — a mid-battle quit keeps it", () => {
    const s = answerRight(start()).state;
    const attempts = Object.values(s.player.mastery["go"]!.components).reduce((n, c) => n + c.attempts, 0);
    expect(attempts).toBe(1);
    expect(s.phase).not.toBe("ended"); // still mid-battle, mastery already banked
  });

  it("reports the moment a component becomes mastered", () => {
    const d = deps(3);
    let s = start(BOSS, player(), 3);
    const events = [];
    for (let i = 0; i < 12 && s.phase === "awaiting-answer"; i += 1) {
      const r = submitAnswer(s, correctIndex(s), d);
      events.push(...r.masteryEvents);
      s = r.state;
    }
    expect(events.some((e) => e.masteredNow)).toBe(true);
  });

  it("survives defeat — losing a fight never costs knowledge (FR-027, US4 scenario 6)", () => {
    const frail = player({ hp: 1 });
    const s = start(BOSS, frail);
    const component = s.currentQuestion!.component;
    const lost = dismissFeedback(answerWrong(s).state, deps()).state;

    expect(lost.outcome).toBe("defeat");
    expect(lost.player.mastery["go"]?.components[component]?.attempts).toBe(1);
    expect(lost.player.xp).toBe(frail.xp);
    expect(lost.player.level).toBe(frail.level);
  });
});

describe("endBattle", () => {
  it("returns the player only once the battle has ended", () => {
    const fresh = start();
    expect(() => endBattle(fresh)).toThrow(/before the battle ended/);
    const won = answerRight({ ...fresh, monsterHp: 1 }).state;
    expect(endBattle(won)).toBe(won.player);
  });
});

describe("purity", () => {
  it("never mutates the state it is given", () => {
    const s = start();
    const snapshot = JSON.stringify(s);
    answerRight(s);
    answerWrong(s);
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});

describe("flee — the paths that change state", () => {
  const neverEscape = () => ({ ...deps(), rng: scriptedRng([0.99]) });

  it("KILLS the player when a failed escape lands the finishing blow", () => {
    // A real state-changing rule with a real consequence: turning to run is not free. Covered
    // because "you died while fleeing" must resolve as a proper defeat, not a stuck battle.
    const attack = content.monster(MOB).attack;
    const frail = player({ hp: attack });
    const result = attemptFlee(start(MOB, frail), neverEscape());

    expect(result.escaped).toBe(false);
    expect(result.state.player.hp).toBe(0);
    expect(result.state.outcome).toBe("defeat");
    expect(result.state.phase).toBe("ended");
    expect(result.state.currentQuestion).toBeNull();
  });

  it("throws if flee is attempted outside the answering phase", () => {
    const s = start(MOB);
    const showing = submitAnswer(s, (s.currentQuestion!.correctIndex + 1) % 4, deps()).state;
    expect(() => attemptFlee(showing, neverEscape())).toThrow(/phase is 'showing-feedback'/);
  });
});
