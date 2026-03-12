import fuzzysort from "fuzzysort";

/**
 * Filter and rank items by query against a key field.
 * Returns sorted array (best match first).
 * Returns all items if query is empty.
 */
export function fuzzySearch<T>(items: T[], query: string, key: keyof T): T[] {
  if (!query) return items;
  const results = fuzzysort.go(query, items, { key: key as string });
  return results.map((r) => r.obj);
}
