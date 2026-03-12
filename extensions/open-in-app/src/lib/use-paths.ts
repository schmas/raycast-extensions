import { LocalStorage } from "@raycast/api";
import { randomUUID } from "crypto";
import { useEffect, useState } from "react";
import * as os from "os";

export interface PathItem {
  id: string;
  path: string; // ~ or absolute, may contain glob chars
  maxDepth?: number;
}

interface PathsHook {
  paths: PathItem[];
  isLoading: boolean;
  addPath: (path: string, maxDepth?: number) => Promise<void>;
  updatePath: (id: string, newPath: string, maxDepth: number | undefined) => Promise<void>;
  deletePath: (id: string) => Promise<void>;
  movePath: (id: string, direction: "up" | "down") => Promise<void>;
  replacePaths: (items: { path: string; maxDepth?: number }[]) => Promise<void>;
}

const STORAGE_KEY = "open-in-app:paths";

/** Shorten absolute path to ~ form for display */
export function displayPath(p: string): string {
  const home = os.homedir();
  return p.startsWith(home) ? "~" + p.slice(home.length) : p;
}

export function usePaths(): PathsHook {
  const [paths, setPaths] = useState<PathItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function load() {
    const raw = await LocalStorage.getItem<string>(STORAGE_KEY);
    try {
      setPaths(raw ? JSON.parse(raw) : []);
    } catch {
      await LocalStorage.removeItem(STORAGE_KEY);
      setPaths([]);
    }
    setIsLoading(false);
  }

  function persist(updated: PathItem[]) {
    LocalStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  useEffect(() => {
    load();
  }, []);

  async function addPath(path: string, maxDepth?: number) {
    setPaths((prev) => {
      const item: PathItem = { id: randomUUID(), path };
      if (maxDepth !== undefined) item.maxDepth = maxDepth;
      const updated = [...prev, item];
      persist(updated);
      return updated;
    });
  }

  async function updatePath(id: string, newPath: string, maxDepth: number | undefined) {
    setPaths((prev) => {
      const updated = prev.map((p) => {
        if (p.id !== id) return p;
        const next: PathItem = { ...p, path: newPath };
        if (maxDepth !== undefined) next.maxDepth = maxDepth;
        else delete next.maxDepth;
        return next;
      });
      persist(updated);
      return updated;
    });
  }

  async function deletePath(id: string) {
    setPaths((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      persist(updated);
      return updated;
    });
  }

  async function movePath(id: string, direction: "up" | "down") {
    setPaths((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx === -1) return prev;
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const updated = [...prev];
      [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
      persist(updated);
      return updated;
    });
  }

  async function replacePaths(items: { path: string; maxDepth?: number }[]) {
    setPaths((prev) => {
      const existingByPath = new Map(prev.map((p) => [p.path, p]));
      const updated = items.map(({ path, maxDepth }) => {
        const existing = existingByPath.get(path);
        const next: PathItem = { id: existing?.id ?? randomUUID(), path };
        if (maxDepth !== undefined) next.maxDepth = maxDepth;
        return next;
      });
      persist(updated);
      return updated;
    });
  }

  return { paths, isLoading, addPath, updatePath, deletePath, movePath, replacePaths };
}
