/**
 * A Node resolver hook that appends `.ts` (or `/index.ts`) when a relative import fails.
 *
 * The app imports extensionlessly because Turbopack requires it, while Node's native type
 * stripping requires explicit extensions. Rather than maintain two import styles — or add a
 * dependency to paper over it — this bridges the gap in about fifteen lines, so `scripts/` can
 * import `src/` and there stays exactly one source of truth for content validation.
 */
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (!specifier.startsWith(".")) throw error;
    for (const suffix of [".ts", "/index.ts", ".tsx"]) {
      try {
        return await nextResolve(specifier + suffix, context);
      } catch {
        // try the next candidate
      }
    }
    throw error;
  }
}
