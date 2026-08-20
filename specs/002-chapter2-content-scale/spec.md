# Feature Specification: Chapter 2 — Content Scale

**Feature Branch**: `002-chapter2-content-scale`

**Created**: 2026-08-20

**Status**: Planned — 2 of 3 clarifications resolved by decision; FR-021 deferred (see below)

**Input**: User description: "The next MVP after the Chapter 1 vertical slice: a second chapter that proves the content pipeline scales beyond one chapter without an engineer."

## Overview

Chapter 1 proved a Word Keeper can explore, learn, fight, and finish a chapter. It did not prove
the thing the whole product depends on next:

> **Can a second chapter be authored without an engineer?**

Constitution Principle III says content is data and adding a word requires no code change.
Feature 001 verified that for **one word and one monster** (SC-008). It has never been tested
against a whole chapter — new grammar, new maps, new NPCs, a new boss, and several hundred
questions.

This feature answers that, and delivers a playable Chapter 2 as the evidence.

**Prerequisite**: this feature assumes the Chapter 1 playtest (001 / T130) returned a positive
answer on whether the battle loop is fun. If it did not, that finding takes precedence and this
feature should be re-scoped or deferred — building a second chapter on an unvalidated loop
doubles the exposure rather than reducing it.

**CEFR note**: Chapter 2 remains **A1**, not A2. The concept document places chapters 1–3 at A1
and 4–6 at A2. Chapter 2 broadens A1 rather than advancing the level.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A content author adds a chapter without engineering help (Priority: P1)

A person who writes English teaching material — not a programmer — opens the content files, adds
Chapter 2's words, questions, grammar lessons, NPCs, dialogue, monsters, and chapter challenge,
places them on maps, and sees the chapter playable. They never open a source file, never run a
build tool they do not understand, and every mistake they make is reported to them in words that
name the file and the field.

**Why this priority**: This is the hypothesis under test. Every other story in this feature is the
evidence that it worked. If authoring a chapter still requires an engineer, the product cannot
reach the dozens of chapters its CEFR progression promises, and that is worth knowing at chapter
2 rather than at chapter 6.

**Independent Test**: Hand the content files and the authoring guide to someone who has not seen
the codebase. Ask them to add five words, one monster, and one NPC. Measure whether they succeed
without asking an engineer a question.

**Acceptance Scenarios**:

1. **Given** a content author with the authoring guide, **When** they add a vocabulary word with
   its forms and questions, **Then** the word appears in the game with no source file changed.
2. **Given** an author who mistypes a grammar topic id, **When** validation runs, **Then** the
   error names the file, the field path, and what was expected — not a stack trace.
3. **Given** an author who adds a word but forgets a question for one of its mastery components,
   **When** validation runs, **Then** it reports that the component can never be mastered, before
   any player meets the word.
4. **Given** a complete Chapter 2 content set, **When** the author runs the validation step,
   **Then** every problem across every file is reported at once rather than one per run.
5. **Given** an author adds a monster, **When** they have supplied no art for it, **Then** a
   placeholder is generated automatically and the monster is playable.

---

### User Story 2 - The player continues from Chapter 1 into Chapter 2 (Priority: P2)

A player who passed the castle gate is told Chapter 1 is over, and Chapter 2 opens to them. Their
level, gold, equipment, pet, and every word they mastered come with them. The world beyond the
gate is new ground.

**Why this priority**: A second chapter that does not connect to the first is a demo, not a
campaign. Continuity is what makes the player's earlier learning feel like it mattered.

**Independent Test**: Load a save with Chapter 1 completed and confirm Chapter 2 is reachable and
all progress carried forward.

**Acceptance Scenarios**:

1. **Given** a player who has completed Chapter 1, **When** they continue, **Then** Chapter 2 is
   available and its first map is reachable.
2. **Given** a player who has NOT completed Chapter 1, **When** they look for Chapter 2, **Then**
   it is not available, and the game says what remains to be done.
3. **Given** a player entering Chapter 2, **When** they check their state, **Then** level, XP,
   gold, inventory, equipped items, pet, grammar learned, and all word mastery are unchanged.
4. **Given** a player in Chapter 2, **When** they open the word journal, **Then** Chapter 1 words
   are still listed with their mastery intact.
5. **Given** a player who wants to revisit Chapter 1, **When** they return to its maps, **Then**
   they may explore and re-fight restored words for practice.

---

### User Story 3 - The player learns Chapter 2's grammar from new characters (Priority: P3)

New NPCs in a new place teach what Chapter 2 adds to the player's English. They are characters
with their own reasons for having lost their words, and their lessons connect to where the player
now is in the story.

**Why this priority**: Grammar is only taught by NPCs, so new grammar requires new characters.
It ranks below continuity because a chapter the player cannot enter teaches nothing.

**Acceptance Scenarios**:

1. **Given** a Chapter 2 NPC with a lesson, **When** the player completes it, **Then** the topic is
   recorded as learned and its dependent questions become eligible in battle.
2. **Given** a player who learned Chapter 1's grammar, **When** they reach Chapter 2, **Then**
   Chapter 1 topics remain learned and are not re-taught as if new.
3. **Given** a Chapter 2 lesson, **When** it is delivered, **Then** it appears inside the dialogue
   frame in the NPC's voice, exactly as Chapter 1's do, and costs no HP.

---

### User Story 4 - Battles mix new words with words the player already met (Priority: P4)

Chapter 2's monsters embody new words, but the questions asked during those fights also revisit
Chapter 1's vocabulary. Words learned earlier keep coming back, which is how they stick.

**Why this priority**: The concept document's whole retention model rests on repeated exposure
across chapters. Chapter 2 is the first chance to prove review works across a chapter boundary,
not just within one.

**Acceptance Scenarios**:

1. **Given** a player fighting a Chapter 2 monster, **When** questions are drawn, **Then** a
   configurable proportion come from words they encountered in Chapter 1.
2. **Given** a Chapter 1 word that was fully mastered, **When** it appears as review and the
   player answers wrongly, **Then** it is demoted and returns for further review.
3. **Given** a player who skipped most of Chapter 1's optional monsters, **When** they fight in
   Chapter 2, **Then** the review pool falls back gracefully to what they did meet.

---

### User Story 5 - The player completes Chapter 2 (Priority: P5)

Chapter 2 ends the way Chapter 1 did: a gatekeeper who asks about everything the chapter taught,
drawing on both chapters' material. Passing completes Chapter 2.

**Why this priority**: Closure. It also proves the chapter mechanism itself is reusable rather
than something built once for Chapter 1.

**Acceptance Scenarios**:

1. **Given** the Chapter 2 boss is defeated, **When** the player reaches the gatekeeper, **Then**
   the Chapter 2 challenge begins.
2. **Given** the challenge is running, **When** questions are drawn, **Then** they come from
   Chapter 2's declared content and from Chapter 1 review material.
3. **Given** the player passes, **When** the challenge resolves, **Then** Chapter 2 is marked
   complete and its completion reward is granted.
4. **Given** the player fails, **When** the challenge resolves, **Then** no HP is lost, mastery is
   kept, the weakest topics are named, and the attempt can be repeated.

---

### Edge Cases

**Authoring**

- What happens when an author adds a word whose forms are spelled identically (`read` / `read` /
  `read`)? Multiple choice cannot distinguish them, and Chapter 1 hit exactly this.
- What happens when an author writes a monster whose entire question pool depends on grammar the
  player has not learned yet? Chapter 1 hit this too, and it made a first battle unplayable.
- What happens when two chapters declare the same word? Mastery must not be duplicated or reset.
- What happens when an author's question set omits a whole difficulty tier or question level?
- What happens when an author places two NPCs on the same map tile, or a spawn outside the map?

**Progression**

- What happens to a save written before Chapter 2 existed? It must load and gain access to the new
  chapter without losing anything.
- What happens if a player completes Chapter 2's boss without ever finishing Chapter 1's? Chapter
  ordering must be enforced or explicitly allowed.
- What happens when a Chapter 1 word is also a Chapter 2 word — does it count twice toward
  mastery-based equipment unlocks?

**Scale**

- What happens to question selection when the review pool is several hundred questions?
- What happens to the word journal when it lists 80 words? Is it still readable and navigable?

## Requirements *(mandatory)*

### Functional Requirements — Authoring

- **FR-001**: A content author MUST be able to add a complete chapter — vocabulary, questions,
  grammar, NPCs, dialogue, monsters, maps, challenge, rewards — without editing any source file.
- **FR-002**: Validation MUST report every problem across every content file in a single run,
  naming the file and the field path for each.
- **FR-003**: Validation MUST reject a word whose declared forms are spelled identically, because
  a multiple-choice question cannot ask a player to choose between two identical options.
- **FR-004**: Validation MUST reject a monster that has fewer than two questions answerable
  without grammar the player may not have learned.
- **FR-005**: Validation MUST reject a chapter in which any word has a mastery component with no
  question, since that component could never be mastered.
- **FR-006**: The system MUST generate conforming placeholder art for any newly authored NPC,
  monster, or map with no supplied art.
- **FR-007**: An authoring guide MUST exist that a non-engineer can follow end to end, covering
  every content file and the validation step.
- **FR-008**: Chapter content MUST be authorable through a guided command-line tool that prompts
  for a word and generates its full question set, writing directly into the content files.
  Hand-editing those files MUST remain possible and MUST stay the source of truth — the tool
  writes the same JSON a person could write by hand, never a parallel format.

  *Decision, 2026-08-20 (previously an open question).* Chapter 1's 177 questions were only tractable
  because they were generated by a throwaway script; Chapter 2 is larger. Hand-editing would
  almost certainly fail this feature's own hypothesis on volume alone. This reverses 001's "no
  content authoring tools" scope boundary, deliberately: that boundary was right for a
  single-chapter slice and is wrong at chapter scale. A spreadsheet import was the alternative and
  remains the natural next step if the author turns out to be a non-technical teacher rather than
  the project owner — but it adds a second format to validate, and one source of truth is worth
  more right now.

### Functional Requirements — Chapter progression

- **FR-009**: The system MUST make Chapter 2 available only when Chapter 1 is complete, and MUST
  tell the player what remains when it is not.
- **FR-010**: The system MUST carry level, XP, gold, inventory, equipped items, pet, grammar
  learned, monsters defeated, and all word mastery from Chapter 1 into Chapter 2 unchanged.
- **FR-011**: The system MUST load a save written before Chapter 2 existed and grant access to the
  new chapter without altering existing progress.
- **FR-012**: The system MUST allow the player to return to Chapter 1's maps for practice after
  completing it.
- **FR-013**: The system MUST count a word toward mastery-based unlocks exactly once, even if more
  than one chapter declares it.

### Functional Requirements — Content and learning

- **FR-014**: Chapter 2 MUST declare at least 30 new A1 vocabulary words and at least 2 new
  grammar topics.
- **FR-015**: Chapter 2 battles MUST draw a configurable proportion of questions from words the
  player encountered in earlier chapters.
- **FR-016**: The Chapter 2 challenge MUST draw from both Chapter 2's declared content and earlier
  chapters' review material.
- **FR-017**: The system MUST NOT re-teach a grammar topic the player already learned as though it
  were new.
- **FR-018**: Chapter 2 MUST provide its own maps, NPCs, monsters, boss, and gatekeeper, following
  the same contracts Chapter 1 uses.
- **FR-019**: All Chapter 2 content MUST be complete in both Thai and English, and target-language
  English MUST NOT be translated.
- **FR-020**: Chapter 2 MUST introduce no new question type and no new battle mechanic. It is
  purely additional content in the systems Chapter 1 already ships.

  *Decision, 2026-08-20 (previously an open question).* This feature exists to measure one thing —
  whether a chapter can be authored without an engineer. Adding a mechanic would confound that
  measurement: a chapter that took longer than expected could be blamed on either cause, and the
  answer would be worthless. New mechanics belong in their own feature, after this one reports.

### Functional Requirements — Roadmap dependency

- **FR-021**: **DEFERRED — requires a constitution amendment, not a spec decision.**

  When the Stage 2 shared open world unlocks is genuinely undecided. The current answer lives in
  the constitution's Product Shape section ("unlocked only after the player completes all mission
  quests"), which places it behind the entire campaign — possibly dozens of hours — so almost no
  player would ever reach it. That is a real risk to it functioning as a retention hook.

  The alternatives are to unlock at the end of Chapter 3 (the end of A1), or to make it a parallel
  mode entered at any level.

  **This does not block Chapter 2.** Chapter 2 implements no Stage 2 behaviour under any of the
  three answers; only the framing of its closing beat would differ. Per the constitution's own
  governance, changing the gate is an amendment the project owner adopts — not something a feature
  spec may decide on its own. Recorded here so it is not lost, and so Chapter 3's spec can treat
  it as a blocking question rather than a note.

### Key Entities *(include if feature involves data)*

- **Chapter**: Already exists. Chapter 2 adds a second instance and, with it, the first real test
  of chapter ordering, cross-chapter review, and progression between chapters.
- **Chapter Progress**: Already exists per chapter. Now needs to express that one chapter gates
  another.
- **Vocabulary Word**: Unchanged in shape. The new question is what happens when the set spans
  several chapters and a word appears in more than one.
- **Authoring Guide**: New. A document, not code, that a non-engineer follows to add content.
- **Content Validation Report**: Already exists as errors. Now needs to serve an author who is not
  reading a terminal built for engineers.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person who has never seen the codebase adds five vocabulary words, one monster,
  and one NPC in under 60 minutes, using only the authoring guide, without asking an engineer.
- **SC-002**: Authoring the whole of Chapter 2 requires zero changes to any source file, verified
  by inspecting the change set.
- **SC-003**: Every content mistake made during Chapter 2's authoring is caught by validation
  before anyone plays it — no defect reaches a play session.
- **SC-004**: Chapter 2 ships at least 30 new A1 words, at least 2 new grammar topics, at least 6
  NPCs, at least 6 monsters plus a boss, and a chapter challenge.
- **SC-005**: A player completes Chapter 2 in a single session of 45 to 90 minutes.
- **SC-006**: At least 25% of questions asked during Chapter 2 battles come from Chapter 1
  vocabulary, measured across a full playthrough.
- **SC-007**: A save created in Chapter 1 before this feature existed loads and reaches Chapter 2
  with 100% of its progress intact.
- **SC-008**: The full automated test suite still completes in under 30 seconds with both chapters
  of content loaded.
- **SC-009**: Both Thai and English are 100% complete for all Chapter 2 content, verified
  automatically.
- **SC-010**: The word journal remains readable and navigable at 70+ words, confirmed by a
  playtester finding a specific word in under 15 seconds.

## Assumptions

- The Chapter 1 playtest returned a positive answer on the core loop. If it did not, that result
  takes precedence over this feature.
- Chapter 2 stays at **A1**. The concept document places chapters 1–3 at A1 and 4–6 at A2, so
  Chapter 2 broadens the level rather than advancing it.
- Chapter 2's grammar is Present Continuous and question forms with *do/does*, both standard A1
  and both natural successors to Present Simple and Past Simple.
- Chapter 2 has three maps, matching Chapter 1's shape, in a new location beyond the castle gate.
- Chapter 1 vocabulary carries forward for review automatically through the existing mechanism;
  no new review system is introduced by this feature.
- Equipment, pets, and the pet ability budget behave in Chapter 2 exactly as in Chapter 1.
- Art remains owner-supplied, with generated placeholders standing in until it arrives.
- Persistence stays local, with the server-backed adapter available but not required.

## Out of Scope

- **Stage 2, the shared open world.** Still its own feature, still gated per the constitution's
  Product Shape section. FR-021 asks only *when* it unlocks, not that it be built here.
- Chapters 3 and beyond, and any A2 content.
- Free-text answers, sentence creation, and question level 6.
- Spaced repetition scheduling across days or sessions — a strong candidate for the feature after
  this one, but not this one.
- Accounts, authentication, cloud sync, and leaderboards.
- Any new battle mechanic, pending the answer to FR-020.
- Analytics and telemetry.
- Mobile touch controls.
