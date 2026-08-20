import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * T006 + T007 — Architectural boundary enforcement.
 *
 * Constitution v1.1.0 Principle II states the dependency rule MUST be enforced by lint rule,
 * not by convention alone. This file is that enforcement. It is the reason `src/core/` stayed
 * byte-for-byte unaffected when the stack changed from Vite to Next.js, and the reason the
 * 30-second Node-only test suite in SC-007 is achievable at all.
 *
 *   app  → components → runtime → core     OK
 *   app  → phaser     → runtime → core     OK
 *   components  <->  phaser                FORBIDDEN
 *   core → phaser | react | next | DOM     FORBIDDEN
 *
 * Do not relax a rule here to make an import work. The import is the bug.
 */

/** Stage 2 (the shared open world) must not leak into Stage 1 — Constitution § Product Shape. */
const STAGE_TWO_PACKAGES = [
  {
    name: "socket.io",
    message:
      "Socket.IO is Stage 2 (the shared open world). Stage 1 ships no realtime code. See research R-017.",
  },
  {
    name: "socket.io-client",
    message:
      "Socket.IO is Stage 2 (the shared open world). Stage 1 ships no realtime code. See research R-017.",
  },
  {
    name: "ws",
    message:
      "WebSockets are Stage 2 (the shared open world). Stage 1 ships no realtime code. See research R-017.",
  },
];

/**
 * Turbopack does not resolve `./foo.js` to `./foo.ts`. tsc and vitest both do, so this mistake
 * typechecks clean, tests green, and then fails only at `next build`.
 *
 * NOTE: ESLint flat config REPLACES a rule's options when a later block redefines it — it does
 * not merge. So this pattern must be repeated in every block that sets `no-restricted-imports`,
 * or it silently vanishes for those files. That is exactly how it failed to fire the first time.
 */
const NO_JS_SPECIFIER = {
  group: ["./*.js", "../*.js", "./**/*.js", "../**/*.js"],
  message:
    "Use an extensionless relative import. moduleResolution is 'bundler'; a .js specifier resolves under tsc and vitest but NOT under Turbopack, so it breaks only at build time.",
};

const RULES_LAYER_MESSAGE =
  "src/core and src/content are framework-free game rules. They must run in a plain Node test with no browser, no renderer, and no SSR hazard. Move this import to src/runtime, src/components, or src/phaser.";

export default tseslint.config(
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "coverage/**", "next-env.d.ts"],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // ---------------------------------------------------------------------------
  // Repo-wide: Stage 2 packages are not installed and must not be imported.
  // ---------------------------------------------------------------------------
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: STAGE_TWO_PACKAGES,
          patterns: [NO_JS_SPECIFIER],
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      // A leading underscore is the conventional "deliberately unused" marker, and typed mock
      // signatures need it — the parameters exist to satisfy a type, not to be read.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // BOUNDARY 1 — src/core and src/content: framework-free rules.
  // No renderer, no framework, no DOM, no non-deterministic randomness.
  // ---------------------------------------------------------------------------
  {
    files: ["src/core/**/*.ts", "src/content/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            ...STAGE_TWO_PACKAGES,
            { name: "phaser", message: RULES_LAYER_MESSAGE },
            { name: "react", message: RULES_LAYER_MESSAGE },
            { name: "react-dom", message: RULES_LAYER_MESSAGE },
            { name: "next", message: RULES_LAYER_MESSAGE },
          ],
          patterns: [
            NO_JS_SPECIFIER,
            {
              group: [
                "next/*",
                "@/runtime",
                "@/runtime/*",
                "@/phaser",
                "@/phaser/*",
                "@/components",
                "@/components/*",
                "@/platform",
                "@/platform/*",
                "../runtime/*",
                "../phaser/*",
                "../components/*",
                "../platform/*",
              ],
              message: RULES_LAYER_MESSAGE,
            },
          ],
        },
      ],
      // localStorage lives behind SaveRepository (contracts/save-format.md). Touching a DOM
      // global here breaks Node tests AND server rendering at the same time.
      "no-restricted-globals": [
        "error",
        { name: "window", message: RULES_LAYER_MESSAGE },
        { name: "document", message: RULES_LAYER_MESSAGE },
        { name: "localStorage", message: RULES_LAYER_MESSAGE },
        { name: "sessionStorage", message: RULES_LAYER_MESSAGE },
        { name: "navigator", message: RULES_LAYER_MESSAGE },
        { name: "fetch", message: "Stage 1 makes no runtime network calls. See plan.md § Constraints." },
      ],
      // Research R-007: all randomness flows through the injected seeded Rng, so question
      // selection, option shuffling, flee, and drops are reproducible from a seed and testable.
      "no-restricted-properties": [
        "error",
        {
          object: "Math",
          property: "random",
          message:
            "Use the injected Rng (src/core/rng). Math.random cannot be seeded, which makes selection, shuffling, flee, and drops untestable. See research R-007.",
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // BOUNDARY 2 — src/runtime: the bridge. Holds state, routes intents, owns no rules.
  // Must not import a renderer: importing Phaser here would break SSR.
  // ---------------------------------------------------------------------------
  {
    files: ["src/runtime/**/*.ts", "src/runtime/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            ...STAGE_TWO_PACKAGES,
            {
              name: "phaser",
              message:
                "The bridge must not import Phaser — it is imported by server-rendered code paths and Phaser touches window at module scope. See research R-013.",
            },
          ],
          patterns: [
            NO_JS_SPECIFIER,
            {
              group: ["@/phaser", "@/phaser/*", "@/components", "@/components/*"],
              message:
                "The bridge is shared by both renderers and must not depend on either. See contracts/runtime-bridge.md.",
            },
          ],
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // BOUNDARY 3 — src/components: React. Renders text. Never imports Phaser.
  // ---------------------------------------------------------------------------
  {
    files: ["src/components/**/*.ts", "src/components/**/*.tsx", "app/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            ...STAGE_TWO_PACKAGES,
            {
              name: "phaser",
              message:
                "React components must not import Phaser. Only src/phaser may, and only through a client-only dynamic import. See research R-013 and R-014.",
            },
          ],
          patterns: [
            NO_JS_SPECIFIER,
            {
              group: ["@/phaser/scenes/*", "@/phaser/sprites/*"],
              message:
                "React renders text; Phaser renders the world. They communicate through src/runtime, never directly. See contracts/runtime-bridge.md.",
            },
          ],
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // BOUNDARY 4 — src/phaser: the world. Never imports React.
  // ---------------------------------------------------------------------------
  {
    files: ["src/phaser/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            ...STAGE_TWO_PACKAGES,
            {
              name: "react",
              message:
                "Phaser scenes must not import React. Both renderers subscribe to src/runtime instead. See contracts/runtime-bridge.md.",
            },
            {
              name: "react-dom",
              message:
                "Phaser scenes must not import React. Both renderers subscribe to src/runtime instead. See contracts/runtime-bridge.md.",
            },
          ],
          patterns: [
            NO_JS_SPECIFIER,
            {
              group: ["@/components", "@/components/*"],
              message:
                "Phaser renders the world; React renders text. They communicate through src/runtime, never directly. See contracts/runtime-bridge.md.",
            },
          ],
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // Tests may reach into any layer.
  // ---------------------------------------------------------------------------
  {
    files: ["tests/**/*.ts", "scripts/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { paths: STAGE_TWO_PACKAGES, patterns: [NO_JS_SPECIFIER] }],
      "no-restricted-properties": "off",
    },
  },
);
