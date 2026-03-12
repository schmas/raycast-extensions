import { LocalStorage } from "@raycast/api";
import { randomUUID } from "crypto";
import { useEffect, useRef, useState } from "react";
import * as os from "os";

export interface PathItem {
  id: string;
  path: string; // ~ or absolute, may contain glob chars
  maxDepth?: number;
}

export interface PathsHook {
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
  const pathsRef = useRef<PathItem[]>([]);

  async function load() {
    const raw = await LocalStorage.getItem<string>(STORAGE_KEY);
    try {
      const parsed: PathItem[] = raw ? JSON.parse(raw) : [];
      pathsRef.current = parsed;
      setPaths(parsed);
    } catch {
      await LocalStorage.removeItem(STORAGE_KEY);
      pathsRef.current = [];
      setPaths([]);
    }
    setIsLoading(false);
  }

  async function persist(updated: PathItem[]) {
    await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  useEffect(() => {
    load();
  }, []);

  async function addPath(path: string, maxDepth?: number) {
    const item: PathItem = { id: randomUUID(), path };
    if (maxDepth !== undefined) item.maxDepth = maxDepth;
    const updated = [...pathsRef.current, item];
    pathsRef.current = updated;
    setPaths(updated);
    await persist(updated);
  }

  async function updatePath(id: string, newPath: string, maxDepth: number | undefined) {
    const updated = pathsRef.current.map((p) => {
      if (p.id !== id) return p;
      const next: PathItem = { ...p, path: newPath };
      if (maxDepth !== undefined) next.maxDepth = maxDepth;
      else delete next.maxDepth;
      return next;
    });
    pathsRef.current = updated;
    setPaths(updated);
    await persist(updated);
  }

  async function deletePath(id: string) {
    const updated = pathsRef.current.filter((p) => p.id !== id);
    pathsRef.current = updated;
    setPaths(updated);
    await persist(updated);
  }

  async function movePath(id: string, direction: "up" | "down") {
    const current = pathsRef.current;
    const idx = current.findIndex((p) => p.id === id);
    if (idx === -1) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= current.length) return;
    const updated = [...current];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    pathsRef.current = updated;
    setPaths(updated);
    await persist(updated);
  }

  async function replacePaths(items: { path: string; maxDepth?: number }[]) {
    const existingByPath = new Map(pathsRef.current.map((p) => [p.path, p]));
    const updated = items.map(({ path, maxDepth }) => {
      const existing = existingByPath.get(path);
      const next: PathItem = { id: existing?.id ?? randomUUID(), path };
      if (maxDepth !== undefined) next.maxDepth = maxDepth;
      return next;
    });
    pathsRef.current = updated;
    setPaths(updated);
    await persist(updated);
  }

  return { paths, isLoading, addPath, updatePath, deletePath, movePath, replacePaths };
}
