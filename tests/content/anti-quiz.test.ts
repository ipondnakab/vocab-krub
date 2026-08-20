import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * T127 — the anti-quiz review, in the part a machine can hold.
 *
 * Constitution Principle I: this is an RPG that teaches, not a quiz with sprites. React renders
 * all the text, which makes HTML's defaults the standing threat — a page of unstyled <button>
 * elements in a system font IS a web form, and no amount of correct battle logic survives
 * looking like one.
 *
 * The judgment half ("does it FEEL like a fight?") is human, and belongs to the playtest. What
 * is mechanical is checked here so it cannot drift back.
 */
function componentSources(): Array<[string, string]> {
  const walk = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) out.push(...walk(path));
      else if (path.endsWith(".tsx")) out.push(path);
    }
    return out;
  };
  return walk("src/components").map((f) => [f, readFileSync(f, "utf8")]);
}

const cssRaw = readFileSync("app/globals.css", "utf8");
/** Comments explain the bugs these rules guard against, and quote the bad patterns verbatim. */
const css = cssRaw.replace(/\/\*[\s\S]*?\*\//g, "");

describe("the UI is not a web form (Principle I)", () => {
  it("uses no native form controls anywhere in the game UI", () => {
    // A radio group of answers is the exact shape of a quiz. Answers are menu commands.
    for (const [file, source] of componentSources()) {
      expect(source, `${file} renders a <form>`).not.toMatch(/<form[\s>]/);
      expect(source, `${file} renders an <input>`).not.toMatch(/<input[\s>]/);
      expect(source, `${file} renders a <select>`).not.toMatch(/<select[\s>]/);
      expect(source, `${file} renders a <textarea>`).not.toMatch(/<textarea[\s>]/);
      expect(source, `${file} uses radio buttons`).not.toMatch(/type=["']radio["']/);
      expect(source, `${file} uses checkboxes`).not.toMatch(/type=["']checkbox["']/);
    }
  });

  it("strips the OS control appearance from every clickable surface", () => {
    for (const selector of [".option", ".action", ".journal__entry"]) {
      const block = css.slice(css.indexOf(selector));
      expect(block.slice(0, 400), `${selector} keeps native appearance`).toMatch(/appearance:\s*none/);
    }
  });

  it("uses hard pixel edges, never rounded web-form corners", () => {
    expect(css).not.toMatch(/border-radius:\s*(?!0)[1-9]/);
  });

  it("never falls back to a system font stack", () => {
    // The fonts are the difference between "a game" and "a page". If the variable is missing,
    // everything silently drops to a serif — which is exactly what happened once already.
    expect(css).toMatch(/--font-display/);
    expect(css).toMatch(/--font-text/);
    // The self-referential declaration that broke this in Phase 3 must never come back.
    expect(css).not.toMatch(/--font-text:\s*var\(--font-text\)/);
    expect(css).not.toMatch(/--font-display:\s*var\(--font-display\)/);
  });

  it("paints a game background rather than a default white page", () => {
    expect(css).toMatch(/body\s*\{[^}]*background:\s*var\(--ground/);
  });
});
