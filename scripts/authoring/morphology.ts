/**
 * English morphology for generated distractors.
 *
 * This file exists because Chapter 1 shipped "I gos every day." A distractor built by blindly
 * appending `s` is a NON-WORD, and a non-word is a weak distractor — the player rules it out
 * without knowing anything. The mistake a learner actually makes is "I goes", and that is the
 * one worth offering.
 */

/** Third-person singular: go → goes, study → studies, play → plays. */
export function thirdPerson(verb: string): string {
  if (/(s|x|z|ch|sh|o)$/.test(verb)) return `${verb}es`;
  if (/[^aeiou]y$/.test(verb)) return `${verb.slice(0, -1)}ies`;
  return `${verb}s`;
}

/** Regular plural: book → books, city → cities, box → boxes. */
export function pluralize(noun: string): string {
  if (/(s|x|z|ch|sh)$/.test(noun)) return `${noun}es`;
  if (/[^aeiou]y$/.test(noun)) return `${noun.slice(0, -1)}ies`;
  return `${noun}s`;
}

/** Regular past: walk → walked, dance → danced, study → studied, stop → stopped. */
export function regularPast(verb: string): string {
  if (/e$/.test(verb)) return `${verb}d`;
  if (/[^aeiou]y$/.test(verb)) return `${verb.slice(0, -1)}ied`;
  return `${verb}ed`;
}

/** Present participle: go → going, dance → dancing, run → running. */
export function presentParticiple(verb: string): string {
  if (/[^aeiou]e$/.test(verb)) return `${verb.slice(0, -1)}ing`;
  if (/^[^aeiou]*[aeiou][^aeiouwxy]$/.test(verb)) return `${verb}${verb.slice(-1)}ing`;
  return `${verb}ing`;
}
