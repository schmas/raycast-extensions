import fuzzysort from "fuzzysort";

/**
 * Filter and rank items by query against a key field.
 * Returns sorted array (best match first).
 * When a tiebreaker is provided, items with equal fuzzy scores are
 * sorted by the tiebreaker (higher = first).
 * Returns all items if query is empty.
 */
export function fuzzySearch<T>(items: T[], query: string, key: keyof T, tiebreaker?: (item: T) => number): T[] {
  if (!query) return items;
  const results = fuzzysort.go(query, items, { key: key as string });
  if (!tiebreaker) return results.map((r) => r.obj);
  // Boost fuzzy score by frecency so frequently-opened items rank higher
  const FRECENCY_BOOST = 3;
  return [...results]
    .sort((a, b) => {
      const sa = a.score + tiebreaker(a.obj) * FRECENCY_BOOST;
      const sb = b.score + tiebreaker(b.obj) * FRECENCY_BOOST;
      return sb - sa;
    })
    .map((r) => r.obj);
}
