/**
 * Content validation errors (FR-050).
 *
 * NOTE — resolved contract inconsistency: contracts/core-api.md described
 * `ContentValidationError` as carrying a single `{ file, path, message }`, while
 * contracts/content-schemas.md required that validation "collect ALL errors and report them
 * together". Those cannot both be true of one object. Resolved by making `ContentIssue` carry
 * the triple and `ContentValidationError` carry the list, which satisfies both intents. The
 * contracts were updated to match. Flagged rather than silently reconciled, per the review gate.
 */

export interface ContentIssue {
  /** The content file the problem is in, e.g. `questions.json`. */
  file: string;
  /** Field path within that file, e.g. `questions[42].options[2]`. */
  path: string;
  message: string;
}

/** `questions.json → questions[42].options[2]: duplicate option: 'went'` */
export function formatIssue(issue: ContentIssue): string {
  return `${issue.file} → ${issue.path}: ${issue.message}`;
}

export class ContentValidationError extends Error {
  readonly issues: readonly ContentIssue[];

  constructor(issues: readonly ContentIssue[]) {
    const body = issues.map((i) => `  ${formatIssue(i)}`).join("\n");
    super(`Content validation failed with ${issues.length} problem(s):\n${body}`);
    this.name = "ContentValidationError";
    this.issues = issues;
  }
}

/** Renders a Zod path array as `questions[42].options[2]`. */
export function formatPath(path: readonly PropertyKey[]): string {
  let out = "";
  for (const segment of path) {
    if (typeof segment === "number") out += `[${segment}]`;
    else out += out === "" ? String(segment) : `.${String(segment)}`;
  }
  return out === "" ? "(root)" : out;
}
