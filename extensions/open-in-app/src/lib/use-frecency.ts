import { LocalStorage } from "@raycast/api";
import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "open-in-app:frecency";
const MAX_ENTRIES = 500;

/** Frequency map: path → open count */
type FreqMap = Record<string, number>;

interface FrecencyHook {
  /** Sort an array of items by open frequency (most used first) */
  sortByFrequency: <T extends { path: string }>(items: T[]) => T[];
  /** Record an open event for the given path */
  trackOpen: (path: string) => void;
}

export function useFrecency(): FrecencyHook {
  const [, setFreqMap] = useState<FreqMap>({});
  // Use ref so trackOpen closure always has latest map
  const freqRef = useRef<FreqMap>({});

  useEffect(() => {
    LocalStorage.getItem<string>(STORAGE_KEY).then((raw) => {
      try {
        const map: FreqMap = raw ? JSON.parse(raw) : {};
        const entries = Object.entries(map);
        if (entries.length > MAX_ENTRIES) {
          const pruned = Object.fromEntries(entries.sort(([, a], [, b]) => b - a).slice(0, MAX_ENTRIES));
          freqRef.current = pruned;
          setFreqMap(pruned);
          LocalStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
        } else {
          freqRef.current = map;
          setFreqMap(map);
        }
      } catch {
        // ignore corrupted data
      }
    });
  }, []);

  function trackOpen(path: string) {
    const updated = { ...freqRef.current, [path]: (freqRef.current[path] ?? 0) + 1 };
    freqRef.current = updated;
    setFreqMap(updated);
    LocalStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  function sortByFrequency<T extends { path: string }>(items: T[]): T[] {
    if (Object.keys(freqRef.current).length === 0) return items;
    return [...items].sort((a, b) => (freqRef.current[b.path] ?? 0) - (freqRef.current[a.path] ?? 0));
  }

  return { sortByFrequency, trackOpen };
}
