import type { BalanceConfig } from "../content/schemas/index";
import {
  attemptFlee, createBattle, dismissFeedback, endBattle, submitAnswer, usePetAbility,
  type BattleState, type BattleTurnResult,
} from "../core/battle/battle";
import {
  applyDefeatPenalty, applyRewards, equip, type RewardOutcome,
} from "../core/progression/rewards";
import {
  advanceChallenge, answerChallenge, chapterOfMonster, finishChallenge, isChallengeComplete,
  isChallengeUnlocked, recordBossDefeated, startChallenge,
  type ChallengeResult, type ChallengeState,
} from "../core/chapter/challenge";
import type { ContentIndex } from "../core/content/loadContent";
import type { Locale } from "../core/i18n/i18n";
import { createNewPlayer, type PlayerState } from "../core/player/playerState";
import type { Rng } from "../core/rng/rng";
import type { SaveRepository } from "../core/save/SaveRepository";
import { enterMap, movePlayer, npcAt, removeMonster, stepPatrol, type WorldState } from "../core/world/worldState";
import {
  advanceDialogue, answerPractice, completeDialogue, startDialogue, type DialogueState,
} from "../core/dialogue/dialogue";
import { facingTile } from "../core/world/movement";
import type { Intent } from "./intents";

/**
 * The runtime bridge (contracts/runtime-bridge.md).
 *
 * One source of truth, two subscribers: React renders text, Phaser renders the world. Both read
 * THIS state. Neither keeps a copy, which is why an HP bar can never disagree with a sprite.
 *
 * THE RULE: this layer routes, `src/core` decides. Every branch below forwards to a core
 * function and stores what it returns — no damage is computed here, no victory decided, no
 * mastery updated.
 */

export type Screen = "title" | "world" | "battle" | "dialogue" | "challenge" | "journal";

export interface Notice {
  kind: "storage-unavailable" | "save-unreadable" | "content-error";
  detail?: string;
}

export interface GameState {
  screen: Screen;
  player: PlayerState;
  world: WorldState | null;
  dialogue: DialogueState | null;
  challenge: ChallengeState | null;
  /** Set once the guard has scored the attempt, so the outcome can be shown in character. */
  challengeResult: ChallengeResult | null;
  battle: BattleState | null;
  /** Where the journal was opened from, so closing it returns you there rather than to the map. */
  screenBefore: Screen | null;
  /** The last resolved turn, so renderers can animate what just happened. */
  lastTurn: BattleTurnResult | null;
  /** What the last victory paid out, for the summary screen. Null until a battle is won. */
  lastRewards: RewardOutcome | null;
  /** Gold lost to the last defeat, so the player is told what it cost. */
  lastDefeatGoldLost: number | null;
  notice: Notice | null;
}

export interface GameStore {
  getSnapshot(): GameState;
  subscribe(listener: () => void): () => void;
  dispatch(intent: Intent): void;
}

export interface GameStoreDeps {
  content: ContentIndex;
  balance: BalanceConfig;
  rng: Rng;
  save: SaveRepository;
  startMapId: string;
  startX: number;
  startY: number;
  locale?: Locale;
}

/**
 * Guards run BEFORE an intent is applied. A guard that returns false means the intent is
 * DROPPED — not queued, not deferred (FR-010).
 *
 * Queuing is what lets an answer submitted during a death animation resolve into a battle that
 * already ended. Core throws on the same condition as a second line of defence; the store's job
 * is to make sure core never sees it.
 */
function canDispatch(intent: Intent, state: GameState): boolean {
  switch (intent.type) {
    case "dismiss-notice":
      return state.notice !== null;
    case "continue-game":
      return state.screen === "title";
    case "start-battle":
      return state.battle === null;
    case "enter-map":
      return true;
    // Exploration is never blocked (FR-006 / Principle I) — but not DURING a battle, because
    // the player is standing in a fight, not on a map.
    case "move":
    case "step-world":
      // Movement is locked for the duration of a conversation (FR-034) and during a battle.
      return state.battle === null && state.dialogue === null && state.world !== null && state.screen === "world";
    case "interact":
      return state.battle === null && state.dialogue === null && state.world !== null && state.screen === "world";
    case "advance-dialogue":
      return state.dialogue !== null && state.dialogue.phase !== "practice";
    case "answer-practice":
      return state.dialogue?.phase === "practice";
    case "close-dialogue":
      return state.dialogue?.phase === "ended";
    case "replay-lesson":
      return state.dialogue !== null;
    // The journal is readable from the world AND mid-battle: checking what you know about the
    // word in front of you is exactly the moment you want it.
    case "open-journal":
      return state.dialogue === null && state.screen !== "journal";
    case "close-journal":
      return state.screen === "journal";
    case "answer-question":
      return state.battle?.phase === "awaiting-answer";
    case "dismiss-feedback":
      return state.battle?.phase === "showing-feedback";
    case "attempt-flee":
      return state.battle?.phase === "awaiting-answer" && !state.battle.isBoss;
    case "use-pet-ability":
      return state.battle?.phase === "awaiting-answer" && state.battle.petUsesRemaining > 0;
    case "equip":
      return state.battle === null;
    case "start-challenge":
      return state.challenge === null && state.battle === null;
    case "answer-challenge":
      return state.challenge !== null && state.challenge.feedback === null && state.challenge.outcome === null;
    case "advance-challenge":
      return state.challenge?.feedback !== null && state.challenge !== null;
    case "close-challenge":
      return state.challenge !== null;
    case "leave-battle":
      return state.battle?.phase === "ended";
    case "new-game":
    case "set-locale":
      return true;
  }
}

export function createGameStore(deps: GameStoreDeps): GameStore {
  const battleDeps = { content: deps.content, balance: deps.balance, rng: deps.rng };

  const freshPlayer = (): PlayerState =>
    createNewPlayer(deps.balance, {
      startMapId: deps.startMapId,
      startX: deps.startX,
      startY: deps.startY,
      ...(deps.locale !== undefined ? { locale: deps.locale } : {}),
    });

  let state: GameState = {
    screen: "title",
    player: freshPlayer(),
    world: null,
    dialogue: null,
    challenge: null,
    challengeResult: null,
    battle: null,
    screenBefore: null,
    lastTurn: null,
    lastRewards: null,
    lastDefeatGoldLost: null,
    notice: deps.save.isAvailable() ? null : { kind: "storage-unavailable" },
  };

  const listeners = new Set<() => void>();

  /** Snapshot identity changes only when state changes, so useSyncExternalStore behaves. */
  const commit = (next: GameState): void => {
    if (next === state) return;
    state = next;
    for (const listener of listeners) listener();
  };

  /**
   * Battle turns all end the same way: keep the state, mirror the player, remember the turn.
   *
   * Rewards land the MOMENT victory is decided, not when the player dismisses the summary — so
   * the summary has something true to show, and closing the tab on the victory screen cannot
   * cost the payout.
   */
  const applyTurn = (result: BattleTurnResult): void => {
    if (result.outcome !== "victory") {
      commit({ ...state, battle: result.state, player: result.state.player, lastTurn: result });
      return;
    }
    const monster = deps.content.monster(result.state.monsterId);
    const rewards = applyRewards(result.state.player, monster.rewards, deps.rng, deps.balance, deps.content);
    commit({
      ...state,
      battle: { ...result.state, player: rewards.player },
      player: rewards.player,
      lastTurn: result,
      lastRewards: rewards,
    });
  };

  return {
    getSnapshot: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    dispatch(intent) {
      if (!canDispatch(intent, state)) return;

      switch (intent.type) {
        case "new-game": {
          const player = freshPlayer();
          deps.save.save(player);
          commit({ ...state, screen: "world", player, world: null, dialogue: null, battle: null, lastTurn: null });
          return;
        }
        case "continue-game": {
          const result = deps.save.load();
          if (result.status === "ok") {
            commit({ ...state, screen: "world", player: result.player, notice: null });
          } else if (result.status === "empty") {
            commit({ ...state, screen: "world", player: freshPlayer() });
          } else {
            commit({ ...state, notice: { kind: "save-unreadable", detail: result.reason } });
          }
          return;
        }
        case "set-locale": {
          commit({ ...state, player: { ...state.player, locale: intent.locale } });
          return;
        }
        case "dismiss-notice": {
          commit({ ...state, notice: null });
          return;
        }
        case "enter-map": {
          const world = enterMap(intent.map, state.player);
          // The map's own player-start is authoritative on a fresh game; an arriving transition
          // has already written the arrival tile into player.location.
          const start = intent.map.playerStart;
          const arriving = state.world?.pendingTransition ?? null;
          const location = arriving
            ? { mapId: intent.map.id, x: arriving.targetX, y: arriving.targetY, facing: arriving.facing }
            : state.player.location.mapId === intent.map.id
              ? state.player.location
              : {
                  mapId: intent.map.id,
                  x: start?.x ?? state.player.location.x,
                  y: start?.y ?? state.player.location.y,
                  facing: start?.facing ?? state.player.location.facing,
                };
          commit({ ...state, screen: "world", world, player: { ...state.player, location } });
          return;
        }
        case "move": {
          const outcome = movePlayer(state.world!, state.player, intent.direction);
          switch (outcome.kind) {
            case "blocked":
              commit({
                ...state,
                player: { ...state.player, location: { ...state.player.location, facing: outcome.facing } },
              });
              return;
            case "moved":
              commit({
                ...state,
                player: {
                  ...state.player,
                  location: { ...state.player.location, x: outcome.x, y: outcome.y, facing: outcome.facing },
                },
              });
              return;
            case "transition":
              // Map files load asynchronously, so the store records the intent and the client
              // fetches, parses, and dispatches `enter-map`. Keeping fetch out of dispatch is
              // what keeps every rule here synchronous and testable.
              commit({ ...state, world: outcome.world });
              return;
            case "encounter": {
              const battle = createBattle({
                monsterId: outcome.monsterId,
                player: state.player,
                content: deps.content,
                balance: deps.balance,
                rng: deps.rng,
              });
              commit({ ...state, screen: "battle", battle, player: battle.player, lastTurn: null });
              return;
            }
          }
          return;
        }
        case "interact": {
          const world = state.world!;
          const { x, y } = facingTile(state.player.location, state.player.location.facing);
          const npc = npcAt(world, x, y);
          if (!npc) return; // Nothing to talk to. Not an error — just air.

          // The guard is a gate, not a conversation, once the boss has fallen.
          const guardedChapter = deps.content.chapters.find(
            (c) => c.challenge.guardNpcId === npc.npcId,
          );
          if (guardedChapter && isChallengeUnlocked(state.player, guardedChapter.id)) {
            const challenge = startChallenge({
              chapterId: guardedChapter.id, player: state.player,
              content: deps.content, balance: deps.balance, rng: deps.rng,
            });
            commit({ ...state, screen: "challenge", challenge, challengeResult: null });
            return;
          }
          const dialogue = startDialogue({
            npcId: npc.npcId, player: state.player, content: deps.content, balance: deps.balance, rng: deps.rng,
          });
          commit({ ...state, screen: "dialogue", dialogue });
          return;
        }
        case "advance-dialogue": {
          commit({ ...state, dialogue: advanceDialogue(state.dialogue!, battleDeps) });
          return;
        }
        case "answer-practice": {
          const result = answerPractice(state.dialogue!, intent.optionIndex, state.player, battleDeps);
          commit({ ...state, dialogue: result.state, player: result.player });
          return;
        }
        case "close-dialogue": {
          // FR-036: the topic is recorded here, on completion, not when the lesson opened.
          const player = completeDialogue(state.dialogue!, state.player);
          deps.save.save(player);
          commit({ ...state, screen: "world", dialogue: null, player });
          return;
        }
        case "replay-lesson": {
          const dialogue = startDialogue({
            npcId: state.dialogue!.npcId, player: state.player, content: deps.content,
            balance: deps.balance, rng: deps.rng, replayLesson: true,
          });
          commit({ ...state, dialogue });
          return;
        }
        case "open-journal": {
          commit({ ...state, screen: "journal", screenBefore: state.screen });
          return;
        }
        case "close-journal": {
          commit({ ...state, screen: state.screenBefore ?? "world" });
          return;
        }
        case "step-world": {
          commit({ ...state, world: stepPatrol(state.world!, state.player, deps.rng) });
          return;
        }
        case "start-battle": {
          const battle = createBattle({
            monsterId: intent.monsterId,
            player: state.player,
            content: deps.content,
            balance: deps.balance,
            rng: deps.rng,
          });
          commit({ ...state, screen: "battle", battle, player: battle.player, lastTurn: null });
          return;
        }
        case "answer-question": {
          applyTurn(submitAnswer(state.battle!, intent.optionIndex, battleDeps));
          return;
        }
        case "dismiss-feedback": {
          applyTurn(dismissFeedback(state.battle!, battleDeps));
          return;
        }
        case "start-challenge": {
          const challenge = startChallenge({
            chapterId: intent.chapterId, player: state.player,
            content: deps.content, balance: deps.balance, rng: deps.rng,
          });
          commit({ ...state, screen: "challenge", challenge, challengeResult: null });
          return;
        }
        case "answer-challenge": {
          const result = answerChallenge(
            state.challenge!, intent.optionIndex, state.player, deps.content, deps.balance,
          );
          commit({ ...state, challenge: result.state, player: result.player });
          return;
        }
        case "advance-challenge": {
          const advanced = advanceChallenge(state.challenge!);
          if (!isChallengeComplete(advanced)) {
            commit({ ...state, challenge: advanced });
            return;
          }
          // FR-048: the chapter completes and its reward lands ONLY on a pass.
          const scored = finishChallenge(advanced, state.player, deps.content, deps.balance);
          deps.save.save(scored.player);
          commit({
            ...state,
            challenge: { ...advanced, outcome: scored.passed ? "passed" : "failed" },
            challengeResult: scored,
            player: scored.player,
          });
          return;
        }
        case "close-challenge": {
          commit({ ...state, screen: "world", challenge: null, challengeResult: null });
          return;
        }
        case "use-pet-ability": {
          const battle = usePetAbility(state.battle!, battleDeps);
          commit({ ...state, battle });
          return;
        }
        case "equip": {
          const player = equip(state.player, intent.itemId, deps.content);
          deps.save.save(player);
          commit({ ...state, player });
          return;
        }
        case "attempt-flee": {
          const result = attemptFlee(state.battle!, battleDeps);
          commit({ ...state, battle: result.state, player: result.state.player });
          return;
        }
        case "leave-battle": {
          const battle = state.battle!;
          let player = endBattle(battle);
          let defeatGoldLost: number | null = null;

          if (battle.outcome === "defeat") {
            // FR-014: costs time and gold, never learning. The penalty function is not even
            // handed anything that could reduce mastery, XP, level, or inventory.
            const penalty = applyDefeatPenalty(player, deps.balance, {
              mapId: deps.startMapId, x: deps.startX, y: deps.startY,
            });
            player = penalty.player;
            defeatGoldLost = penalty.goldLost;
          }

          // FR-033: a restored word does not come back. Recorded on the player so it survives
          // save/load, and removed from the live map so it is gone the moment you look up.
          let world = state.world;
          if (battle.outcome === "victory") {
            if (!player.monstersDefeated.includes(battle.monsterId)) {
              player = { ...player, monstersDefeated: [...player.monstersDefeated, battle.monsterId] };
            }
            if (world) world = removeMonster(world, battle.monsterId);

            // FR-045: restoring the chapter boss is what opens the castle gate.
            if (battle.isBoss) {
              const chapterId = chapterOfMonster(battle.monsterId, deps.content);
              if (chapterId) player = recordBossDefeated(player, chapterId);
            }
          }

          deps.save.save(player);
          commit({
            ...state, screen: "world", player, world, battle: null,
            lastTurn: null, lastRewards: null, lastDefeatGoldLost: defeatGoldLost,
          });
          return;
        }
      }
    },
  };
}
