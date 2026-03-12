import { LocalStorage } from "@raycast/api";
import { randomUUID } from "crypto";
import { useEffect, useState } from "react";

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

  async function load() {
    const raw = await LocalStorage.getItem<string>(STORAGE_KEY);
    try {
      setApps(raw ? JSON.parse(raw) : []);
    } catch {
      // corrupted storage — reset
      await LocalStorage.removeItem(STORAGE_KEY);
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
    const updated = [...apps, { ...data, id: randomUUID() }];
    setApps(updated);
    await persist(updated);
  }

  async function updateApp(app: AppConfig) {
    const updated = apps.map((a) => (a.id === app.id ? app : a));
    setApps(updated);
    await persist(updated);
  }

  async function deleteApp(id: string) {
    const updated = apps.filter((a) => a.id !== id);
    setApps(updated);
    await persist(updated);
  }

  async function moveApp(id: string, direction: "up" | "down") {
    const idx = apps.findIndex((a) => a.id === id);
    if (idx === -1) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= apps.length) return;
    const updated = [...apps];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    setApps(updated);
    await persist(updated);
  }

  return { apps, isLoading, addApp, updateApp, deleteApp, moveApp };
}
