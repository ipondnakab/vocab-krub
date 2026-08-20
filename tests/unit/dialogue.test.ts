import { describe, expect, it } from "vitest";
import {
  advanceDialogue, answerPractice, completeDialogue, currentLine, hasCompletedLesson, startDialogue,
  type DialogueDeps, type DialogueState,
} from "../../src/core/dialogue/dialogue";
import { balance, content, player, rng } from "../helpers/fixtures";
import type { PlayerState } from "../../src/core/player/playerState";

const deps: DialogueDeps = { content, balance, rng: rng(3) };
const TEACHER = "teacher-mali";

const open = (p: PlayerState = player({ grammarLearned: [] }), replay = false) =>
  startDialogue({ npcId: TEACHER, player: p, content, balance, rng: rng(3), replayLesson: replay });

/** Walks a conversation to its end, answering practice with the given correctness. */
function runToEnd(state: DialogueState, p: PlayerState, alwaysCorrect: boolean) {
  let s = state;
  let current = p;
  for (let i = 0; i < 60 && s.phase !== "ended"; i += 1) {
    if (s.phase === "practice") {
      const q = s.currentPractice!;
      const index = alwaysCorrect ? q.correctIndex : (q.correctIndex + 1) % q.options.length;
      const result = answerPractice(s, index, current, deps);
      s = result.state;
      current = result.player;
    } else {
      s = advanceDialogue(s, deps);
    }
  }
  return { state: s, player: current };
}

describe("dialogue traversal (FR-034)", () => {
  it("opens on the NPC's first-meeting node", () => {
    const s = open();
    expect(s.npcId).toBe(TEACHER);
    expect(s.nodeId).toBe(content.npc(TEACHER).dialogueId);
    expect(s.phase).toBe("lines");
    expect(s.lineIndex).toBe(0);
  });

  it("advances multi-page lines in order", () => {
    let s = open();
    const lines = content.dialogueNode(s.nodeId).lines;
    expect(lines.length).toBeGreaterThan(1);
    for (let i = 0; i < lines.length; i += 1) {
      expect(currentLine(s, deps)).toEqual(lines[i]);
      s = advanceDialogue(s, deps);
    }
    expect(s.phase).not.toBe("lines");
  });

  it("moves into practice once the lines run out (FR-035)", () => {
    let s = open();
    while (s.phase === "lines") s = advanceDialogue(s, deps);
    expect(s.phase).toBe("practice");
    expect(s.currentPractice).not.toBeNull();
  });

  it("asks every practice question in sequence, then ends", () => {
    const s = open();
    const expected = content.dialogueNode(s.nodeId).practiceQuestionIds.length;
    let asked = 0;
    let current = s;
    let p = player({ grammarLearned: [] });
    for (let i = 0; i < 60 && current.phase !== "ended"; i += 1) {
      if (current.phase === "practice") {
        asked += 1;
        const q = current.currentPractice!;
        const result = answerPractice(current, q.correctIndex, p, deps);
        current = result.state;
        p = result.player;
      } else {
        current = advanceDialogue(current, deps);
      }
    }
    expect(asked).toBe(expected);
    expect(current.phase).toBe("ended");
  });

  it("reports completion once and stays ended", () => {
    const { state } = runToEnd(open(), player({ grammarLearned: [] }), true);
    expect(state.phase).toBe("ended");
    expect(advanceDialogue(state, deps)).toBe(state);
  });
});

describe("grammar lessons (FR-036, FR-037)", () => {
  it("records the topic as learned on first completion", () => {
    const before = player({ grammarLearned: [] });
    const { state, player: after } = runToEnd(open(before), before, true);
    const learned = completeDialogue(state, after);
    expect(learned.grammarLearned).toContain("present-simple");
  });

  it("does not double-record on a replay", () => {
    const learnedAlready = player({ grammarLearned: ["present-simple"] });
    const { state, player: after } = runToEnd(open(learnedAlready, true), learnedAlready, true);
    const result = completeDialogue(state, after);
    expect(result.grammarLearned.filter((t) => t === "present-simple")).toHaveLength(1);
  });

  it("says something DIFFERENT once the lesson is done (FR-037)", () => {
    const npc = content.npc(TEACHER);
    const first = open(player({ grammarLearned: [] }));
    const again = open(player({ grammarLearned: ["present-simple"] }));
    expect(first.nodeId).toBe(npc.dialogueId);
    expect(again.nodeId).toBe(npc.repeatDialogueId);
    expect(again.nodeId).not.toBe(first.nodeId);
  });

  it("replays the lesson on request", () => {
    const p = player({ grammarLearned: ["present-simple"] });
    expect(open(p, true).nodeId).toBe(content.npc(TEACHER).dialogueId);
  });

  it("knows whether an NPC's lesson is finished", () => {
    expect(hasCompletedLesson(TEACHER, player({ grammarLearned: [] }), content)).toBe(false);
    expect(hasCompletedLesson(TEACHER, player({ grammarLearned: ["present-simple"] }), content)).toBe(true);
    // The guard teaches nothing, so there is no lesson to have completed.
    expect(hasCompletedLesson("guard-thanet", player(), content)).toBe(false);
  });

  it("unlocks the topic's dependent questions for battle selection", () => {
    const before = player({ grammarLearned: [] });
    const { state, player: after } = runToEnd(open(before), before, true);
    const learned = completeDialogue(state, after);
    const gated = content.questions.filter((q) => q.requiresGrammar === "present-simple");
    expect(gated.length).toBeGreaterThan(0);
    for (const q of gated) expect(learned.grammarLearned).toContain(q.requiresGrammar);
  });
});

describe("practice costs nothing (FR-038)", () => {
  it("corrects a wrong answer IN CHARACTER and keeps going", () => {
    let s = open();
    while (s.phase === "lines") s = advanceDialogue(s, deps);
    const q = s.currentPractice!;
    const result = answerPractice(s, (q.correctIndex + 1) % q.options.length, player({ grammarLearned: [] }), deps);

    expect(result.correct).toBe(false);
    expect(result.state.phase).toBe("practice-feedback");
    expect(result.state.feedback?.correctOption).toBe(q.options[q.correctIndex]);
    expect(result.state.feedback?.explanation.th.length).toBeGreaterThan(0);
    expect(advanceDialogue(result.state, deps).phase).not.toBe("practice-feedback");
  });

  it("changes NOTHING on the player except mastery — no HP, no gold, no XP", () => {
    // FR-038 made structural: this module never receives a way to reduce HP.
    const before = player({ grammarLearned: [] });
    const { player: after } = runToEnd(open(before), before, false);
    expect(after.hp).toBe(before.hp);
    expect(after.maxHp).toBe(before.maxHp);
    expect(after.gold).toBe(before.gold);
    expect(after.xp).toBe(before.xp);
    expect(after.level).toBe(before.level);
    expect(after.inventory).toEqual(before.inventory);
  });

  it("still records mastery — practice is real learning, not a warm-up", () => {
    const before = player({ grammarLearned: [] });
    const { state, player: after } = runToEnd(open(before), before, true);
    expect(state.masteryEvents.length).toBeGreaterThan(0);
    const touched = Object.values(after.mastery).flatMap((m) => Object.values(m.components));
    expect(touched.some((c) => c.attempts > 0)).toBe(true);
  });

  it("throws if an answer arrives outside the practice phase", () => {
    expect(() => answerPractice(open(), 0, player(), deps)).toThrow(/phase is 'lines'/);
  });
});
