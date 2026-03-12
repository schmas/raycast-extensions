import { LocalStorage } from "@raycast/api";
import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "open-in-app:last-app";

type AppHistory = { last: string; secondLast?: string };
type LastAppMap = Record<string, AppHistory>;

interface LastAppHook {
  getLastApp: (folderPath: string) => string | null;
  getSecondLastApp: (folderPath: string) => string | null;
  setLastApp: (folderPath: string, appId: string) => void;
}

function migrateEntry(value: unknown): AppHistory {
  if (typeof value === "string") return { last: value };
  return value as AppHistory;
}

export function useLastApp(): LastAppHook {
  const [, setMap] = useState<LastAppMap>({});
  const mapRef = useRef<LastAppMap>({});

  useEffect(() => {
    LocalStorage.getItem<string>(STORAGE_KEY).then((raw) => {
      try {
        const rawParsed = raw ? JSON.parse(raw) : {};
        const migrated: LastAppMap = {};
        for (const [path, value] of Object.entries(rawParsed)) {
          migrated[path] = migrateEntry(value);
        }
        mapRef.current = migrated;
        setMap(migrated);
      } catch {
        LocalStorage.removeItem(STORAGE_KEY);
      }
    });
  }, []);

  function getLastApp(folderPath: string): string | null {
    return mapRef.current[folderPath]?.last ?? null;
  }

  function getSecondLastApp(folderPath: string): string | null {
    return mapRef.current[folderPath]?.secondLast ?? null;
  }

  function setLastApp(folderPath: string, appId: string): void {
    const current = mapRef.current[folderPath];
    if (current?.last === appId) return;

    const updated: LastAppMap = {
      ...mapRef.current,
      [folderPath]: { last: appId, secondLast: current?.last },
    };
    mapRef.current = updated;
    setMap(updated);
    LocalStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  return { getLastApp, getSecondLastApp, setLastApp };
}
