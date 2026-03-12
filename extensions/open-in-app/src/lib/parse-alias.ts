/**
 * Parses a query string into alias + search term.
 * Only treats first word as alias if followed by a space.
 * "ij react" → { alias: "ij", query: "react" }
 * "ijproject" → { alias: null, query: "ijproject" }
 * "react"     → { alias: null, query: "react" }
 */
export function parseAlias(input: string): { alias: string | null; query: string } {
  const spaceIdx = input.indexOf(" ");
  if (spaceIdx === -1) {
    return { alias: null, query: input };
  }
  return { alias: input.slice(0, spaceIdx), query: input.slice(spaceIdx + 1) };
}
