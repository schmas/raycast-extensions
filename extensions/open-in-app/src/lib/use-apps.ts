import { LocalStorage } from "@raycast/api";
import { randomUUID } from "crypto";
import { useEffect, useRef, useState } from "react";

export interface AppConfig {
  id: string;
  alias: string; // e.g. "ij"
  name: string; // e.g. "IntelliJ IDEA"
  bundleId: string; // bundleId or app path used to launch
  appPath?: string; // macOS .app path — used for file icons
}

export interface AppConfigHook {
  apps: AppConfig[];
  isLoading: boolean;
  addApp: (data: Omit<AppConfig, "id">) => Promise<void>;
  updateApp: (app: AppConfig) => Promise<void>;
  deleteApp: (id: string) => Promise<void>;
  moveApp: (id: string, direction: "up" | "down") => Promise<void>;
}

const STORAGE_KEY = "open-in-app:apps";

export function useApps(): AppConfigHook {
  const [apps, setApps] = useState<AppConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const appsRef = useRef<AppConfig[]>([]);

  async function load() {
    const raw = await LocalStorage.getItem<string>(STORAGE_KEY);
    try {
      const parsed: AppConfig[] = raw ? JSON.parse(raw) : [];
      appsRef.current = parsed;
      setApps(parsed);
    } catch {
      // corrupted storage — reset
      await LocalStorage.removeItem(STORAGE_KEY);
      appsRef.current = [];
      setApps([]);
    }
    setIsLoading(false);
  }

  async function persist(updated: AppConfig[]) {
    await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  useEffect(() => {
    load();
  }, []);

  async function addApp(data: Omit<AppConfig, "id">) {
    const updated = [...appsRef.current, { ...data, id: randomUUID() }];
    appsRef.current = updated;
    setApps(updated);
    await persist(updated);
  }

  async function updateApp(app: AppConfig) {
    const updated = appsRef.current.map((a) => (a.id === app.id ? app : a));
    appsRef.current = updated;
    setApps(updated);
    await persist(updated);
  }

  async function deleteApp(id: string) {
    const updated = appsRef.current.filter((a) => a.id !== id);
    appsRef.current = updated;
    setApps(updated);
    await persist(updated);
  }

  async function moveApp(id: string, direction: "up" | "down") {
    const current = appsRef.current;
    const idx = current.findIndex((a) => a.id === id);
    if (idx === -1) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= current.length) return;
    const updated = [...current];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    appsRef.current = updated;
    setApps(updated);
    await persist(updated);
  }

  return { apps, isLoading, addApp, updateApp, deleteApp, moveApp };
}
