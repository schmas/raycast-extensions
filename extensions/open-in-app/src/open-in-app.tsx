import {
  Action,
  ActionPanel,
  Application,
  Icon,
  List,
  LocalStorage,
  getApplications,
  getPreferenceValues,
  open,
  openExtensionPreferences,
} from "@raycast/api";
import { useEffect, useState } from "react";
import ManageApps from "./manage-apps";
import { fuzzySearch } from "./lib/fuzzy-search";
import { useFrecency } from "./lib/use-frecency";
import { useLastApp } from "./lib/use-last-app";
import { openInApp } from "./lib/open-in-app";
import { parseAlias } from "./lib/parse-alias";
import { AppConfig, useApps } from "./lib/use-apps";
import { useFolders } from "./lib/use-folders";
import { usePaths } from "./lib/use-paths";

interface Preferences {
  defaultTerminal?: Application;
}

/** Resolves the .app path for an AppConfig — prefers stored appPath, falls back to runtime lookup */
function useAppIconResolver() {
  const [pathMap, setPathMap] = useState<Record<string, string>>({});
  useEffect(() => {
    getApplications().then((installed) => {
      const map: Record<string, string> = {};
      for (const a of installed) {
        if (a.bundleId) map[a.bundleId] = a.path;
        map[a.path] = a.path;
      }
      setPathMap(map);
    });
  }, []);
  return (app: AppConfig) => {
    const path = app.appPath || pathMap[app.bundleId];
    return path ? { fileIcon: path } : Icon.AppWindow;
  };
}

/** Action that pushes the Manage Apps & Paths screen */
function ManageAction() {
  return (
    <Action.Push
      title="Manage Apps & Paths"
      icon={Icon.Gear}
      target={<ManageApps />}
      shortcut={{ modifiers: ["cmd", "shift"], key: "m" }}
    />
  );
}

const SHORTCUT_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

function appShortcut(index: number) {
  return index < SHORTCUT_KEYS.length ? { modifiers: ["cmd" as const], key: SHORTCUT_KEYS[index] } : undefined;
}

const SHOW_FILES_KEY = "open-in-app:show-files";

export default function OpenInApp() {
  const [query, setQuery] = useState("");
  const [showFiles, setShowFiles] = useState(false);
  const { paths, isLoading: pathsLoading } = usePaths();
  const { folders, isLoading: foldersLoading } = useFolders(paths, showFiles);

  useEffect(() => {
    LocalStorage.getItem<string>(SHOW_FILES_KEY).then((val) => {
      if (val === "true") setShowFiles(true);
    });
  }, []);

  function toggleShowFiles() {
    const next = !showFiles;
    setShowFiles(next);
    LocalStorage.setItem(SHOW_FILES_KEY, String(next));
  }
  const { apps, isLoading: appsLoading } = useApps();
  const { defaultTerminal } = getPreferenceValues<Preferences>();
  const appIcon = useAppIconResolver();
  const { sortByFrequency, trackOpen } = useFrecency();
  const { getLastApp, getSecondLastApp, setLastApp } = useLastApp();

  const isLoading = pathsLoading || foldersLoading || appsLoading;

  const { alias, query: searchTerm } = parseAlias(query);
  const activeApp = alias ? (apps.find((a) => a.alias === alias) ?? null) : null;

  // When searching: fuzzy sort. When no query: frecency sort (most used first)
  const filtered = fuzzySearch(folders, searchTerm, "name");
  const results = searchTerm ? filtered : sortByFrequency(filtered);

  if (!appsLoading && apps.length === 0) {
    return (
      <List>
        <List.Section title="Get Started">
          <List.Item
            title="Choose Default Terminal"
            subtitle={defaultTerminal ? defaultTerminal.name : "Optional — open folders in terminal with ⌘T"}
            icon={defaultTerminal ? { fileIcon: defaultTerminal.path } : Icon.Terminal}
            accessories={defaultTerminal ? [{ text: "✓ Configured" }] : []}
            actions={
              <ActionPanel>
                <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
              </ActionPanel>
            }
          />
          <List.Item
            title="Add Apps & Search Paths"
            subtitle="Configure which apps to use and which folders to search"
            icon={Icon.AppWindow}
            actions={
              <ActionPanel>
                <ManageAction />
              </ActionPanel>
            }
          />
        </List.Section>
      </List>
    );
  }

  if (!pathsLoading && paths.length === 0) {
    return (
      <List>
        <List.EmptyView
          title="No search paths configured"
          description="Press ⌘⇧M to open Manage Apps & Paths"
          actions={
            <ActionPanel>
              <ManageAction />
            </ActionPanel>
          }
        />
      </List>
    );
  }

  return (
    <List
      filtering={false}
      isLoading={isLoading}
      onSearchTextChange={setQuery}
      searchBarPlaceholder="Type alias + query (e.g. ij react) or just search..."
    >
      {results.map((folder) => {
        const lastAppId = getLastApp(folder.path);
        const secondLastAppId = getSecondLastApp(folder.path);
        const lastApp = lastAppId ? (apps.find((a) => a.id === lastAppId) ?? null) : null;
        const secondLastApp = secondLastAppId ? (apps.find((a) => a.id === secondLastAppId) ?? null) : null;
        const primaryApp = activeApp ?? lastApp ?? apps[0] ?? null;
        const secondaryApp = !activeApp && secondLastApp?.id !== primaryApp?.id ? secondLastApp : null;

        return (
          <List.Item
            key={folder.path}
            icon={folder.isDirectory ? Icon.Folder : Icon.Document}
            title={folder.name}
            subtitle={folder.displayPath}
            accessories={activeApp ? [{ text: `[${activeApp.alias}]` }] : []}
            actions={
              <ActionPanel>
                {primaryApp && (
                  <Action
                    title={`Open in ${primaryApp.name}`}
                    icon={appIcon(primaryApp)}
                    shortcut={appShortcut(apps.findIndex((a) => a.id === primaryApp.id))}
                    onAction={() => {
                      trackOpen(folder.path);
                      setLastApp(folder.path, primaryApp.id);
                      openInApp(folder.path, primaryApp);
                    }}
                  />
                )}
                {secondaryApp && (
                  <Action
                    title={`Open in ${secondaryApp.name}`}
                    icon={appIcon(secondaryApp)}
                    shortcut={appShortcut(apps.findIndex((a) => a.id === secondaryApp.id))}
                    onAction={() => {
                      trackOpen(folder.path);
                      setLastApp(folder.path, secondaryApp.id);
                      openInApp(folder.path, secondaryApp);
                    }}
                  />
                )}
                {apps
                  .filter((app) => app.id !== primaryApp?.id && app.id !== secondaryApp?.id)
                  .map((app) => (
                    <Action
                      key={app.id}
                      title={`Open in ${app.name}`}
                      icon={appIcon(app)}
                      shortcut={appShortcut(apps.findIndex((a) => a.id === app.id))}
                      onAction={() => {
                        trackOpen(folder.path);
                        setLastApp(folder.path, app.id);
                        openInApp(folder.path, app);
                      }}
                    />
                  ))}

                <ActionPanel.Section>
                  {/* Terminal */}
                  {defaultTerminal && (
                    <Action
                      title={`Open in ${defaultTerminal.name}`}
                      icon={defaultTerminal.path ? { fileIcon: defaultTerminal.path } : Icon.Terminal}
                      shortcut={{ modifiers: ["cmd"], key: "t" }}
                      onAction={() => {
                        trackOpen(folder.path);
                        open(folder.path, defaultTerminal.bundleId || defaultTerminal.path);
                      }}
                    />
                  )}
                  {/* Finder */}
                  <Action.ShowInFinder path={folder.path} shortcut={{ modifiers: ["cmd"], key: "f" }} />
                  <Action.CopyToClipboard
                    title="Copy Path"
                    content={folder.path}
                    shortcut={{ modifiers: ["cmd"], key: "c" }}
                  />
                </ActionPanel.Section>

                <ActionPanel.Section>
                  <Action
                    title={showFiles ? "Show Folders Only" : "Show Files and Folders"}
                    icon={showFiles ? Icon.Folder : Icon.Document}
                    shortcut={{ modifiers: ["cmd"], key: "." }}
                    onAction={toggleShowFiles}
                  />
                  <ManageAction />
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}
