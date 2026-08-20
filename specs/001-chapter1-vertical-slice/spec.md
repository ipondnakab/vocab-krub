# Feature Specification: Chapter 1 Vertical Slice

**Feature Branch**: `001-chapter1-vertical-slice`

**Created**: 2026-08-20

**Status**: Draft — stack revised 2026-08-20 (Next.js + React + Phaser)

**Input**: User description: "Vocab Krub MVP — a 2D old-school JRPG in which the player learns English by playing a real RPG. Build one complete vertical slice of Chapter 1: a village, a forest, and a dungeon; NPCs who teach grammar; vocabulary monsters fought through turn-based question combat; vocabulary mastery; XP, gold, items and pets; and a chapter challenge that gates progression."

## Overview

Vocab Krub ships in two stages:

- **Stage 1 — The Learning Campaign.** Single-player. The player works through chapters of mission
  quests, learning vocabulary and grammar by playing an RPG. Fully playable offline.
- **Stage 2 — The Shared Open World.** Unlocked only after all mission quests are complete. Word
  Keepers who finished the campaign enter a persistent shared world together.

**This feature is Chapter 1 of Stage 1, and it is the entire MVP.** Stage 2 is future scope with its
own specification; nothing in it is built, stubbed, or scaffolded here.

Its purpose is to answer one question:

> **Is learning English through a real RPG battle loop actually fun?**

Everything in scope exists to make that question answerable. Anything that does not serve it is
future scope.

The player is a **Word Keeper** in a world where forgotten words have been corrupted by **The
Silence** and turned into monsters. The player restores words by understanding them. Knowledge is
the weapon: a correct answer is an attack, a wrong answer is an opening for the monster.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fight a vocabulary monster in turn-based question combat (Priority: P1)

A player encounters a corrupted word — say **GO** — and enters a turn-based battle. Each turn the
monster's corruption manifests as a question about the word. If the player answers correctly, the
Word Keeper strikes and the monster's HP drops. If the player answers incorrectly, the game shows
what the right answer was and why, then the monster strikes back and the player's HP drops. The
battle continues turn after turn until one side reaches zero HP. On victory the word is *restored*,
not killed.

**Why this priority**: This is the hypothesis under test. Every other story is scaffolding that
delivers the player to this loop or rewards them for completing it. If this loop is not fun, the
product does not work and nothing else matters.

**Independent Test**: Launch directly into a battle against a seeded monster via a development
entry point, with no map, no NPC, and no save file. A tester can play a complete battle to victory
and to defeat and judge whether it feels like an RPG fight rather than a quiz.

**Acceptance Scenarios**:

1. **Given** a battle has started against monster GO with 100 HP and the player has 100 HP,
   **When** the battle screen appears, **Then** both HP bars, the monster sprite, and the first
   question with its answer options are visible before any input is accepted.
2. **Given** a question is displayed and the player has not yet answered, **When** the player
   selects the correct option, **Then** the player performs an attack animation, the monster's HP
   decreases by the damage configured for that question's difficulty, and the monster's HP does not
   decrease by any other amount.
3. **Given** a question is displayed, **When** the player selects an incorrect option, **Then** the
   monster's HP is unchanged, the correct answer and a short explanation are shown to the player,
   and only after that feedback is dismissed does the monster attack and reduce the player's HP.
4. **Given** the monster's HP is greater than zero after the player's attack, **When** the turn
   resolves, **Then** a new question is presented and the battle continues.
5. **Given** the monster's HP reaches exactly zero or below, **When** the turn resolves, **Then**
   the battle ends in victory, the restoration sequence plays, and no further question is asked.
6. **Given** the player's HP reaches exactly zero or below, **When** the turn resolves, **Then** the
   battle ends in defeat and no further question is asked.
7. **Given** a battle against a non-boss monster is in progress, **When** the player chooses to
   flee and the flee attempt succeeds, **Then** the battle ends without victory or defeat, the
   player returns to the map, and all mastery earned during that battle is retained.
8. **Given** a battle against a boss or chapter challenge is in progress, **When** the player looks
   for a flee option, **Then** no flee option is available.

---

### User Story 2 - Explore the world and choose your fights (Priority: P2)

The player walks a Word Keeper avatar through a village, out into a forest, and down into a cave.
Buildings, trees, water, and walls block movement. Monsters are visible on the map as wandering
corrupted words; walking into one starts a battle. The player decides when and what to fight.

**Why this priority**: Exploration is what makes this an RPG rather than a quiz app. It is also the
delivery mechanism for every other system. It ranks below the battle only because the battle is the
hypothesis; without exploration the hypothesis cannot be tested honestly.

**Independent Test**: Load the village map with battles stubbed out. A tester can walk the full
village → forest → cave route, be blocked by collision, and trigger a map transition at each
boundary.

**Acceptance Scenarios**:

1. **Given** the player is standing in the village, **When** they press a movement input, **Then**
   the avatar moves in that direction with a walk animation and stops at the tile boundary.
2. **Given** the player walks into a building, tree, cliff, or map edge, **When** the movement is
   attempted, **Then** the avatar does not pass through and does not become stuck in the obstacle.
3. **Given** the player steps onto a marked transition tile at the village edge, **When** the
   transition triggers, **Then** the forest map loads and the avatar appears at the corresponding
   arrival point facing into the new map.
4. **Given** a visible monster is wandering on the forest map, **When** the player's avatar
   contacts it, **Then** a battle against that monster's configured word begins.
5. **Given** the player defeated a monster and returned to the map, **When** they look at where the
   monster stood, **Then** that monster is gone and does not immediately respawn under the player.
6. **Given** the player is anywhere on any map, **When** they choose to move, **Then** movement is
   available — exploration is never blocked by an unprompted quiz.

---

### User Story 3 - Learn grammar from NPCs who are characters (Priority: P3)

The player talks to villagers. A teacher explains Present Simple through a story reason — she is
trying to remember how to describe her daily routine now that The Silence has taken the words. A
merchant teaches practical shop English. A scholar explains Past Simple. Each lesson ends with a
short practice exchange inside the conversation, not on a test screen. Completing a lesson unlocks
the question types that depend on it.

**Why this priority**: Grammar is taught by NPCs rather than monsters, so NPC dialogue is the only
channel for it. It ranks after exploration because a lesson the player cannot walk up to is not a
lesson.

**Independent Test**: Place the teacher NPC in an otherwise empty map. A tester can approach, open
dialogue, read a multi-page lesson, answer the in-dialogue practice questions, and see the lesson
marked as learned.

**Acceptance Scenarios**:

1. **Given** the player is standing adjacent to an NPC and facing them, **When** the player presses
   the interact input, **Then** a dialogue box opens with that NPC's portrait, name, and first line.
2. **Given** a dialogue box is open with more lines remaining, **When** the player advances,
   **Then** the next line is shown and player movement remains locked until the dialogue closes.
3. **Given** an NPC is delivering a grammar lesson, **When** the lesson reaches its practice
   section, **Then** practice questions are presented inside the dialogue frame in the NPC's voice,
   not on a separate quiz screen.
4. **Given** the player answers a practice question incorrectly, **When** the answer is submitted,
   **Then** the NPC corrects them in character and the lesson continues — no HP is lost, because
   NPC lessons are not combat.
5. **Given** the player completes a grammar lesson for the first time, **When** the dialogue closes,
   **Then** that grammar topic is recorded as learned and questions depending on it become eligible
   for selection in battle.
6. **Given** the player talks to an NPC whose lesson they have already completed, **When** dialogue
   opens, **Then** the NPC says something different that acknowledges the prior conversation, and
   the lesson can be replayed on request.

---

### User Story 4 - Build and keep vocabulary mastery (Priority: P4)

Battle HP and knowledge are separate. Knocking a monster's HP to zero wins the fight; understanding
the word is tracked independently, component by component — its meaning, each of its forms, its use
in context. The player can open a word journal and see exactly which parts of which words they have
mastered and which are still missing. Words already learned keep reappearing in later battles for
review.

**Why this priority**: This is what makes the product educational rather than a themed shooter. It
must be visible to the player for the learning to feel real, but the battle loop can be evaluated
for fun before the journal exists.

**Independent Test**: Drive the mastery module directly with a scripted sequence of correct and
incorrect answers and assert the resulting mastery state, with no rendering involved. Then open the
journal in-game and confirm it displays that same state.

**Acceptance Scenarios**:

1. **Given** the player has never seen the word GO, **When** they open the word journal, **Then**
   GO shows 0% mastery with every component unchecked.
2. **Given** a mastery component requires 2 consecutive correct answers, **When** the player answers
   one question on that component correctly, **Then** the component is not yet mastered.
3. **Given** the player answers a second consecutive question on that component correctly, **When**
   the answer resolves, **Then** that component is marked mastered and the word's mastery
   percentage increases accordingly.
4. **Given** a component was mastered, **When** the player later answers a question on it
   incorrectly, **Then** the component is demoted and requires one correct review answer to be
   restored — mastery already earned is never wiped to zero.
5. **Given** every component of a word is mastered, **When** the last one completes, **Then** the
   word is marked MASTERED with a five-star display and a restoration moment is shown.
6. **Given** the player is defeated in battle, **When** they respawn, **Then** all mastery earned
   before and during that battle is intact — losing a fight never costs knowledge.
7. **Given** the player has mastered words from earlier in the chapter, **When** they fight a new
   monster, **Then** a configurable proportion of that battle's questions are drawn from previously
   learned words for review.

---

### User Story 5 - Earn RPG rewards for learning (Priority: P5)

Victory pays out. The player gains XP toward levels, gold to spend, and sometimes an item, a piece
of equipment, or a word fragment. Equipment is earned by learning, not grinding: a sword that hits
harder, a robe that softens the sting of a wrong answer, a pet owl that removes one wrong option
once per battle. Nothing the player can equip will answer a question for them.

**Why this priority**: Rewards convert learning into RPG progression and are what make the loop
feel like an RPG rather than a drill. They depend on the battle and mastery systems existing first.

**Independent Test**: Resolve a scripted victory against a configured monster and assert the exact
XP, gold, and item payout, plus any level-up, with no rendering. Then equip each item and assert its
effect changes the relevant computed value.

**Acceptance Scenarios**:

1. **Given** the player defeats a monster with configured rewards, **When** the victory screen
   resolves, **Then** the XP, gold, and any item drops shown match the monster's reward data exactly.
2. **Given** the player's XP crosses a level threshold, **When** rewards apply, **Then** the player
   levels up, maximum HP increases per the balance configuration, and current HP is restored to the
   new maximum.
3. **Given** the player equips a weapon with a damage modifier, **When** they next answer a question
   correctly, **Then** the damage dealt reflects that modifier.
4. **Given** the player equips armor that reduces wrong-answer damage, **When** they next answer
   incorrectly, **Then** the damage taken is reduced by the configured amount but is never reduced
   below zero, and the correct answer is still shown.
5. **Given** the player has an owl pet with one reveal per battle, **When** they use its ability,
   **Then** exactly one incorrect option is removed from the current question, the ability is
   consumed for that battle, and the remaining options still include the correct answer.
6. **Given** the player has any equipment or pet equipped, **When** any question is presented,
   **Then** no equipment effect selects, submits, or auto-answers the question.
7. **Given** the player masters the number of words configured as an equipment unlock threshold,
   **When** the threshold is crossed, **Then** the corresponding equipment is granted and the player
   is told which learning milestone earned it.

---

### User Story 6 - Prove what you learned and finish the chapter (Priority: P6)

At the castle gate the guard will not let the player pass on reputation. He asks questions drawn
from everything Chapter 1 taught — the vocabulary, Present Simple, Past Simple. The player must
answer enough of them correctly. Passing opens the gate and completes Chapter 1. Failing sends the
player back to study, with the guard telling them, in character, what they were weakest on.

**Why this priority**: The chapter challenge is what makes progression feel earned and closes the
narrative arc of the slice. It requires vocabulary, grammar, and mastery to already exist.

**Independent Test**: Trigger the challenge directly with a seeded player profile. A tester can pass
it with correct answers and fail it with incorrect ones, and observe both outcomes.

**Acceptance Scenarios**:

1. **Given** the player has defeated the chapter boss, **When** they approach the castle gate,
   **Then** the guard initiates the chapter challenge in dialogue, framed as a story moment.
2. **Given** the challenge is configured for a number of questions and a pass threshold, **When**
   the player answers, **Then** questions are drawn only from Chapter 1's vocabulary and grammar
   topics and the running progress is visible.
3. **Given** the player meets or exceeds the pass threshold, **When** the final question resolves,
   **Then** the challenge is passed, Chapter 1 is marked complete, the chapter completion reward is
   granted, and the gate opens.
4. **Given** the player scores below the pass threshold, **When** the final question resolves,
   **Then** the challenge is failed, the guard names the weakest topics in character, the gate stays
   shut, and the player keeps all mastery gained during the attempt.
5. **Given** the player failed the challenge, **When** they return to the guard, **Then** they may
   retry with a freshly drawn question set and are never permanently locked out.
6. **Given** the challenge is in progress, **When** the player answers incorrectly, **Then** no HP
   is lost — the challenge is a gate, not a fight.

---

### User Story 7 - Keep your progress (Priority: P7)

The player closes the game and comes back. Their level, HP, XP, gold, inventory, equipped gear, pet,
word mastery, grammar lessons learned, defeated monsters, chapter progress, and map position are all
where they left them.

**Why this priority**: Required for the slice to be evaluated over more than one sitting, but the
loop can be judged fun within a single session, so it lands last.

**Independent Test**: Serialize a fully populated player state, deserialize it into a fresh runtime,
and assert deep equality with no rendering involved.

**Acceptance Scenarios**:

1. **Given** a player with progress in every tracked system, **When** the game saves and is then
   reloaded, **Then** every tracked value is identical to before the save.
2. **Given** the player is mid-battle, **When** they quit without finishing, **Then** the battle is
   not resumed on reload; the player restarts from their last map position with mastery earned
   during that battle already recorded.
3. **Given** no save data exists, **When** the game starts, **Then** a new game begins at the
   Chapter 1 opening with default player state and no error is shown.
4. **Given** save data written by an older, incompatible version exists, **When** the game starts,
   **Then** the player is told the save cannot be loaded and is offered a new game rather than
   silently crashing or corrupting.

---

### Edge Cases

**Battle**

- What happens when a monster's question pool is smaller than the number of turns the battle lasts?
  Questions must be reusable without the same question appearing twice in a row.
- What happens when a question pool for a monster is empty or all its questions depend on grammar
  the player has not learned? The battle must not start with nothing to ask.
- What happens when damage would take HP below zero? HP floors at zero; no negative HP is displayed
  or stored.
- What happens when the player's HP and the monster's HP would both reach zero on the same turn?
  Only one side acts per turn, so this cannot occur — the spec must make the ordering explicit.
- What happens when the player answers while the previous turn's animation is still playing? Input
  must be locked during resolution.
- What happens when a player flees repeatedly to avoid all learning? Flee must have a configurable
  failure chance and must not award rewards.
- What happens when the player is defeated? Defined consequence, and mastery must survive it.

**Learning**

- What happens when a word has only one form (no irregular forms)? Its component set must still be
  valid and masterable.
- What happens when a wrong answer is submitted on a component that is already mastered? Demotion
  rules must be unambiguous.
- What happens when the review-question pool is empty because the player has learned nothing yet?
  Selection must fall back to the current monster's word.
- What happens when a distractor option happens to also be a correct answer? Content validation
  must reject that at load time.

**World and content**

- What happens when a map transition points at a map that failed to load? The player must not be
  stranded on a black screen.
- What happens when an NPC has a lesson referencing a grammar topic that does not exist in content?
  Validation must fail loudly at load time naming the file and field.
- What happens when the player talks to an NPC while a monster is adjacent? Only one interaction may
  own input at a time.

**Localization**

- What happens when a locale key is missing in `th` but present in `en`? Development builds must
  surface it visibly; it must never silently render an empty box.
- What happens to the English content under test when the player switches to Thai? Target-language
  content must never be translated — only instruction and explanation switch.

**Persistence**

- What happens when local storage is full, disabled, or unavailable? The player must be warned that
  progress will not persist rather than losing data silently.
- What happens when save data is present but malformed? Handled as an unloadable save, not a crash.

## Requirements *(mandatory)*

### Functional Requirements — Battle

- **FR-001**: System MUST resolve exactly one question per battle turn, and one question MUST grant
  at most one attack opportunity.
- **FR-002**: System MUST, on a correct answer, apply player damage to the monster and MUST NOT
  allow the monster to attack on that turn.
- **FR-003**: System MUST, on an incorrect answer, apply monster damage to the player and MUST NOT
  apply any player damage to the monster on that turn.
- **FR-004**: System MUST display the correct answer and a short explanation after every incorrect
  answer, before the monster's counterattack resolves.
- **FR-005**: System MUST compute player attack damage from the question's difficulty tier and the
  player's equipped weapon, using values read from balance configuration.
- **FR-006**: System MUST compute monster attack damage from the monster's attack value reduced by
  the player's equipped armor, using values read from balance configuration, and MUST floor the
  result at zero.
- **FR-007**: System MUST continue the battle while both combatants have HP above zero.
- **FR-008**: System MUST end the battle in victory when monster HP reaches zero or below, and in
  defeat when player HP reaches zero or below.
- **FR-009**: System MUST clamp all HP values to the range zero through maximum HP.
- **FR-010**: System MUST lock player input while a turn is resolving and MUST discard inputs
  received during that window rather than queueing them.
- **FR-011**: System MUST offer a flee action in non-boss battles, resolve it against a configurable
  success chance, consume the turn on failure, and award no rewards on success.
- **FR-012**: System MUST NOT offer a flee action in boss battles or the chapter challenge.
- **FR-013**: System MUST NOT present the same question twice consecutively within a battle, and
  MUST prefer unasked questions until the pool is exhausted.
- **FR-014**: System MUST define and apply a defeat consequence that costs the player time and a
  configurable amount of gold, and MUST NOT reduce vocabulary mastery, XP, level, or inventory on
  defeat.

### Functional Requirements — Questions and Learning

- **FR-015**: System MUST support question levels 1 through 5: meaning, recognition, word form,
  fill-in-the-blank, and context.
- **FR-016**: System MUST NOT implement free-text sentence creation grading; question level 6 is out
  of scope for this feature.
- **FR-017**: Every question MUST declare the vocabulary word it tests, the mastery component it
  exercises, its difficulty tier, and any grammar topic it depends on.
- **FR-018**: System MUST exclude questions whose required grammar topic the player has not yet
  learned from battle selection.
- **FR-019**: System MUST select battle questions weighted toward the monster's own word and toward
  mastery components the player has not yet mastered.
- **FR-020**: System MUST include review questions drawn from previously encountered words at a
  configurable proportion of each battle's questions, falling back gracefully when no review pool
  exists.
- **FR-021**: System MUST present multiple-choice options in a randomized order so the correct
  answer's position is not predictable.
- **FR-022**: System MUST reject at content-validation time any question whose distractor is also a
  valid answer, whose correct answer is absent from its options, or whose referenced word, grammar
  topic, or component does not exist.

### Functional Requirements — Mastery

- **FR-023**: System MUST derive each word's mastery component set from its data: its meaning, one
  component per declared word form, and its contextual use.
- **FR-024**: System MUST require a configurable number of consecutive correct answers on a
  component before marking that component mastered, defaulting to more than one.
- **FR-025**: System MUST demote a mastered component on a later incorrect answer such that a single
  correct review answer restores it, and MUST NOT reset the word's overall progress to zero.
- **FR-026**: System MUST compute a word's mastery percentage as mastered components over total
  components, and MUST mark a word MASTERED only when every component is mastered.
- **FR-027**: System MUST preserve all mastery across battle defeat, flight, quitting, and reload.
- **FR-028**: System MUST provide a word journal showing, per word, its mastery percentage and the
  mastered state of each individual component.
- **FR-029**: System MUST track mastery independently of battle HP; the two MUST NOT be derived from
  each other.

### Functional Requirements — Exploration and NPCs

- **FR-030**: System MUST let the player move the avatar in four directions with collision against
  impassable tiles and map boundaries.
- **FR-031**: System MUST provide a village map, a forest map, and a cave map, connected by
  transition points with matching arrival positions.
- **FR-032**: System MUST render monsters as visible map entities and start a battle on contact.
- **FR-033**: System MUST NOT respawn a defeated monster within the same map visit.
- **FR-034**: System MUST let the player interact with an NPC when adjacent and facing them, and
  MUST lock movement for the duration of the conversation.
- **FR-035**: System MUST deliver every grammar lesson inside the dialogue presentation, including
  its practice questions.
- **FR-036**: System MUST record a grammar topic as learned on first completion of its lesson and
  MUST allow the lesson to be replayed.
- **FR-037**: System MUST vary NPC dialogue based on whether their lesson has already been
  completed.
- **FR-038**: System MUST NOT deduct HP or any resource for incorrect answers given during NPC
  practice.

### Functional Requirements — Progression and Rewards

- **FR-039**: System MUST grant XP, gold, and any configured item drops on victory, matching the
  monster's reward data.
- **FR-040**: System MUST level the player up when XP crosses a configured threshold, raise maximum
  HP per configuration, and restore current HP to the new maximum.
- **FR-041**: System MUST support equippable weapons and armor whose effects are declared in data
  and applied to damage calculations.
- **FR-042**: System MUST support at least one pet with a battle ability limited to a configurable
  number of uses per battle.
- **FR-043**: System MUST NOT allow any item, equipment, or pet effect to select or submit an answer
  on the player's behalf, or to skip a question.
- **FR-044**: System MUST grant configured equipment when the player crosses a mastery-count
  threshold, and MUST tell the player which learning milestone earned it.
- **FR-045**: System MUST gate the chapter challenge behind defeat of the chapter boss.
- **FR-046**: System MUST draw chapter challenge questions only from the chapter's declared
  vocabulary and grammar topics.
- **FR-047**: System MUST pass the challenge at or above a configurable threshold and fail it below,
  MUST NOT apply HP damage during the challenge, and MUST allow unlimited retries with a freshly
  drawn question set.
- **FR-048**: System MUST mark the chapter complete and grant its completion reward only on a pass.

### Functional Requirements — Content, Localization, Persistence

- **FR-049**: System MUST load all vocabulary, questions, grammar, monsters, NPCs, dialogue, items,
  pets, chapters, rewards, and balance values from data files, with no such content hardcoded in
  gameplay logic.
- **FR-050**: System MUST validate all content against schemas at build or load time and MUST fail
  with a message naming the offending file and field.
- **FR-051**: System MUST resolve every user-visible string through a locale layer supporting Thai
  and English, and MUST make a missing key visible in development rather than rendering blank.
- **FR-052**: System MUST NOT translate the English content under test when the interface locale
  changes.
- **FR-053**: System MUST persist player progress through a storage interface, with a local
  implementation for this feature and no gameplay code changes required to swap implementations.
- **FR-054**: System MUST round-trip every persisted value without loss.
- **FR-055**: System MUST start a new game cleanly when no save exists, and MUST report an
  unloadable or malformed save to the player without crashing.
- **FR-056**: System MUST warn the player when storage is unavailable so they know progress will not
  persist.

### Key Entities *(include if feature involves data)*

- **Vocabulary Word**: A word the player learns. Carries an identifier, the English word, its
  meaning in each supported locale, its CEFR level, topic, difficulty, its word family forms, usage
  examples, and the mastery components required to master it. Referenced by monsters and questions.
- **Word Form**: One inflected member of a word family — for GO: go, went, gone, going — each with
  the grammatical role it fills. Word forms generate mastery components and answer options.
- **Mastery Component**: One independently trackable facet of knowing a word: its meaning, one per
  form, its contextual use. Holds a correct-streak and a mastered flag.
- **Question**: One asked item. References a vocabulary word, the mastery component it exercises, a
  level (1–5), a difficulty tier that determines damage, an optional required grammar topic, a
  prompt, options, the correct answer, and the explanation shown on a wrong answer.
- **Grammar Topic**: A teachable concept such as Present Simple. Referenced by NPC lessons and by
  questions that depend on it. Tracked per player as learned or not.
- **NPC**: A character on a map with a role, a portrait, a position, a dialogue tree, and optionally
  one grammar lesson. Has distinct dialogue before and after lesson completion.
- **Dialogue Node**: One unit of conversation — a speaker, localized lines, and what follows, which
  may be another node, a practice question, or the end of the conversation.
- **Monster**: A corrupted word. References one vocabulary word, and carries its own HP, attack
  value, difficulty, sprite and animation data, its question pool, and its reward table. Flagged as
  boss or not.
- **Player State**: Level, XP, current and maximum HP, gold, inventory, equipped weapon, armor, and
  pet, mastery records per word, grammar topics learned, monsters defeated, current chapter and
  progress within it, current map and position.
- **Battle State**: The transient state of one fight — participants, current HP values, turn number,
  the active question, questions already asked, pet ability uses remaining, and the battle's
  outcome once decided.
- **Item / Equipment / Pet**: Ownable objects whose effects are declared as data — damage modifiers,
  damage reduction, hint or reveal abilities, XP bonuses — along with how they are obtained.
- **Chapter**: A unit of content declaring its maps, required vocabulary, grammar topics, monsters,
  NPCs, boss, challenge configuration, and completion reward.
- **Balance Configuration**: The tunable numbers — damage per difficulty tier, monster and player
  base stats, XP curve, mastery streak requirement, review question proportion, flee chance, defeat
  penalty, challenge length and pass threshold.
- **Locale Bundle**: The full set of user-visible strings for one language, keyed identically across
  languages.
- **Save Game**: A versioned serialization of player state, with the schema version it was written
  against.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new player reaches their first battle within 3 minutes of starting the game, without
  reading external instructions.
- **SC-002**: A player can complete the full Chapter 1 arc — village, forest, cave, boss, chapter
  challenge — in a single session of 45 to 90 minutes.
- **SC-003**: Chapter 1 ships at least 30 vocabulary words, at least 2 grammar topics, at least 6
  NPCs, at least 6 monsters plus a boss, at least 3 items, and at least 1 pet.
- **SC-004**: Every question level from 1 through 5 appears at least once during a normal Chapter 1
  playthrough.
- **SC-005**: A player who answers every question correctly never takes damage; a player who answers
  every question incorrectly is always defeated. Both are verified by automated test.
- **SC-006**: 100% of rules that change HP, XP, gold, mastery, inventory, or chapter status are
  covered by automated tests that run without a browser.
- **SC-007**: The game's rules test suite completes in under 30 seconds so balance changes can be
  verified quickly.
- **SC-008**: Adding one new vocabulary word with its questions and one new monster requires editing
  only content data files — zero engine source files changed. Verified by doing it.
- **SC-009**: Both Thai and English locale bundles are 100% complete for all shipped user-visible
  text, verified by an automated key-parity check.
- **SC-010**: A full save/load round trip preserves 100% of tracked player state, verified by
  automated test.
- **SC-011**: The game holds a stable frame rate on a mid-range laptop during exploration and
  battle, with no perceptible input lag on answer selection.
- **SC-012**: At least 5 playtesters complete the vertical slice and answer whether the battle loop
  was fun, producing the evidence this MVP exists to gather.

## Assumptions

These were confirmed with the project owner or chosen as reasonable defaults where the concept
document was silent.

**Confirmed with the project owner**

- The game is bilingual from the first commit, with Thai and English locale bundles maintained in
  parallel. Every user-visible string goes through the locale layer from day one.
- Question level 6, sentence creation, is cut from the MVP entirely. No free-text grading, no
  partial implementation, no placeholder. Levels 1 through 5 carry the slice.
- Persistence is local for this feature, behind a storage interface. A Firebase adapter is added as
  the final MVP task and must not require gameplay code changes.
- All world and character art, tilemaps, and audio are supplied by the project owner. Engineering
  defines a documented asset contract — dimensions, sprite sheet frame order, animation names, tile
  IDs, map layer names — and builds against generated placeholders that conform to it. UI chrome is
  CSS rather than art, so dialogue frames, buttons, panels, and bars need no files.
- The game is delivered as a Next.js application. React renders every piece of text the player reads;
  Phaser renders the world, sprites, and animations. The split is driven by Thai typography: combining
  vowels and tone marks render correctly in DOM and unreliably in canvas bitmap text.
- Socket.IO and the shared open world belong to Stage 2, land after the Stage 1 playtest, and get no
  dependency, no stub, and no configuration key in this feature.

**Chosen defaults, open to revision**

- Encounters are visible on the map and initiated by contact, not random. This gives the player
  agency over when to be tested, which serves the "game first" principle better than random
  encounters and avoids the frustration of being ambushed by a quiz.
- Defeat costs time and a configurable amount of gold, and returns the player to the village. It
  never costs mastery, XP, or level. Learning progress is never punished.
- A mastery component requires 2 consecutive correct answers by default, tunable in balance
  configuration.
- The chapter challenge is a dialogue-framed gate rather than a battle, so failing it costs no HP.
- Chapter 1 teaches Present Simple and Past Simple, with the boss being the word GO, whose forms
  exercise both.
- Desktop is the primary target. The layout is built responsively and mobile is verified, but touch
  controls are not a shipping requirement for this slice.
- No audio is required for the slice to be evaluated; hooks exist but silence is acceptable.
- The surrounding web application ships as a landing page and the `/play` route only. Account,
  profile, leaderboard, and settings pages are future scope — the Next.js app exists to host the game
  and to make those pages cheap later, not to deliver them now.

## Out of Scope

Named explicitly so they are not built speculatively.

**Stage 2 — deferred to its own specification, built only after the Stage 1 playtest**

- The shared open world, and the campaign-completion gate that admits players to it.
- Socket.IO, the realtime server, presence, matchmaking, and any multiplayer state.
- Accounts, authentication, and cloud sync. No socket dependency, presence type, or `multiplayer`
  configuration key may appear in this feature (Constitution: Product Shape).

**Deferred regardless of stage**

- Chapters 2 and beyond, and any content authoring beyond Chapter 1.
- Free-text answers, sentence creation, writing, speaking, and listening skills.
- IELTS, TOEFL, or any proficiency examination content or scoring.
- Leaderboards, profile pages, and settings pages beyond a locale switch.
- Shops, crafting, and side quests beyond the chapter's main line.
- Spaced repetition scheduling across sessions beyond the in-chapter review mechanic.
- Analytics, telemetry, and content authoring tools.
- Mobile touch controls and native packaging.
