import {
  Action,
  ActionPanel,
  Alert,
  Application,
  Form,
  Icon,
  List,
  Toast,
  confirmAlert,
  getApplications,
  getPreferenceValues,
  openExtensionPreferences,
  showToast,
  useNavigation,
} from "@raycast/api";
import { useEffect, useState } from "react";
import { AppConfig, AppConfigHook, useApps } from "./lib/use-apps";
import { PathItem, PathsHook, displayPath, usePaths } from "./lib/use-paths";

export default function ManageApps({
  sharedApps,
  sharedPaths,
}: {
  sharedApps?: AppConfigHook;
  sharedPaths?: PathsHook;
} = {}) {
  const ownApps = useApps();
  const ownPaths = usePaths();
  const { apps, isLoading: appsLoading, addApp, updateApp, deleteApp, moveApp } = sharedApps ?? ownApps;
  const {
    paths,
    isLoading: pathsLoading,
    addPath,
    updatePath,
    deletePath,
    movePath,
    replacePaths,
  } = sharedPaths ?? ownPaths;
  const { defaultTerminal } = getPreferenceValues<Preferences.ManageApps>();

  async function handleDeleteApp(app: AppConfig) {
    const confirmed = await confirmAlert({
      title: `Delete "${app.name}"?`,
      message: "This action cannot be undone.",
      primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
    });
    if (confirmed) await deleteApp(app.id);
  }

  async function handleDeletePath(item: PathItem) {
    const confirmed = await confirmAlert({
      title: `Remove "${displayPath(item.path)}"?`,
      primaryAction: { title: "Remove", style: Alert.ActionStyle.Destructive },
    });
    if (confirmed) await deletePath(item.id);
  }

  return (
    <List isLoading={appsLoading || pathsLoading}>
      {/* Terminal section */}
      <List.Section title="Terminal">
        <List.Item
          title="Default Terminal"
          subtitle={defaultTerminal ? defaultTerminal.name : "Not configured"}
          icon={defaultTerminal?.path ? { fileIcon: defaultTerminal.path } : Icon.Terminal}
          actions={
            <ActionPanel>
              <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
            </ActionPanel>
          }
        />
      </List.Section>

      {/* Apps section */}
      <List.Section title="Apps">
        {apps.map((app) => (
          <List.Item
            key={app.id}
            icon={app.appPath ? { fileIcon: app.appPath } : Icon.AppWindow}
            title={app.name}
            subtitle={`alias: ${app.alias}`}
            accessories={[{ text: app.bundleId }]}
            actions={
              <ActionPanel>
                <Action.Push
                  title="Edit"
                  target={<AppForm app={app} onSave={(v) => updateApp({ ...app, ...v })} existingApps={apps} />}
                />
                <Action
                  title="Move up"
                  icon={Icon.ArrowUp}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "arrowUp" }}
                  onAction={() => moveApp(app.id, "up")}
                />
                <Action
                  title="Move Down"
                  icon={Icon.ArrowDown}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "arrowDown" }}
                  onAction={() => moveApp(app.id, "down")}
                />
                <Action title="Delete" style={Action.Style.Destructive} onAction={() => handleDeleteApp(app)} />
              </ActionPanel>
            }
          />
        ))}
        <List.Item
          title="Add App"
          icon={Icon.Plus}
          actions={
            <ActionPanel>
              <Action.Push title="Add App" target={<AppForm onSave={addApp} existingApps={apps} />} />
            </ActionPanel>
          }
        />
      </List.Section>

      {/* Search Paths section */}
      <List.Section title="Search Paths">
        {paths.map((item) => (
          <List.Item
            key={item.id}
            icon={Icon.Folder}
            title={displayPath(item.path)}
            subtitle={item.path}
            accessories={item.maxDepth !== undefined ? [{ text: `depth: ${item.maxDepth}` }] : []}
            actions={
              <ActionPanel>
                <Action.Push
                  title="Edit"
                  icon={Icon.Pencil}
                  target={<PathForm item={item} onSave={(p, d) => updatePath(item.id, p, d)} />}
                />
                <Action
                  title="Move up"
                  icon={Icon.ArrowUp}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "arrowUp" }}
                  onAction={() => movePath(item.id, "up")}
                />
                <Action
                  title="Move Down"
                  icon={Icon.ArrowDown}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "arrowDown" }}
                  onAction={() => movePath(item.id, "down")}
                />
                <Action
                  title="Remove"
                  icon={Icon.Trash}
                  style={Action.Style.Destructive}
                  onAction={() => handleDeletePath(item)}
                />
              </ActionPanel>
            }
          />
        ))}
        <List.Item
          title="Edit All Paths"
          subtitle="Bulk edit — one path per line"
          icon={Icon.TextCursor}
          actions={
            <ActionPanel>
              <Action.Push title="Edit All Paths" target={<PathsBulkForm paths={paths} onSave={replacePaths} />} />
            </ActionPanel>
          }
        />
        <List.Item
          title="Add Search Path"
          icon={Icon.Plus}
          actions={
            <ActionPanel>
              <Action.Push title="Add Search Path" target={<PathForm onSave={(p, d) => addPath(p, d)} />} />
            </ActionPanel>
          }
        />
      </List.Section>
    </List>
  );
}

// --- App Form ---

interface AppFormValues {
  alias: string;
  appId: string; // bundleId or app path, from getApplications()
}

function AppForm({
  app,
  onSave,
  existingApps,
}: {
  app?: AppConfig;
  onSave: (data: Omit<AppConfig, "id">) => Promise<void>;
  existingApps: AppConfig[];
}) {
  const { pop } = useNavigation();
  const [installedApps, setInstalledApps] = useState<Application[]>([]);
  const [isLoadingApps, setIsLoadingApps] = useState(true);

  useEffect(() => {
    getApplications()
      .then((apps) => setInstalledApps(apps.sort((a, b) => a.name.localeCompare(b.name))))
      .finally(() => setIsLoadingApps(false));
  }, []);

  async function handleSubmit(values: AppFormValues) {
    const alias = values.alias.trim();
    if (!alias) {
      await showToast({ style: Toast.Style.Failure, title: "Alias is required" });
      return;
    }
    if (alias.includes(" ")) {
      await showToast({ style: Toast.Style.Failure, title: "Alias cannot contain spaces" });
      return;
    }
    if (!values.appId) {
      await showToast({ style: Toast.Style.Failure, title: "Please select an application" });
      return;
    }
    const duplicate = existingApps.find((a) => a.alias === alias && a.id !== app?.id);
    if (duplicate) {
      await showToast({ style: Toast.Style.Failure, title: `Alias "${alias}" is already used by ${duplicate.name}` });
      return;
    }
    const selected = installedApps.find((a) => (a.bundleId || a.path) === values.appId);
    if (!selected) return;
    await onSave({ alias, name: selected.name, bundleId: values.appId, appPath: selected.path });
    pop();
  }

  return (
    <Form
      navigationTitle={app ? "Edit App" : "Add App"}
      isLoading={isLoadingApps}
      actions={
        <ActionPanel>
          <Action.SubmitForm title={app ? "Save Changes" : "Add App"} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="alias"
        title="Alias"
        placeholder="ij"
        defaultValue={app?.alias}
        info="Short prefix used to target this app (e.g. 'ij react')"
      />
      <Form.Dropdown id="appId" title="Application" defaultValue={app?.bundleId}>
        {installedApps.map((a) => (
          <Form.Dropdown.Item
            key={a.bundleId || a.path}
            value={a.bundleId || a.path}
            title={a.name}
            icon={{ fileIcon: a.path }}
          />
        ))}
      </Form.Dropdown>
    </Form>
  );
}

// --- Paths Bulk Form ---

function PathsBulkForm({
  paths,
  onSave,
}: {
  paths: PathItem[];
  onSave: (items: { path: string; maxDepth?: number }[]) => Promise<void>;
}) {
  const { pop } = useNavigation();

  function serialize(items: PathItem[]): string {
    return items.map((p) => (p.maxDepth !== undefined ? `${p.path},${p.maxDepth}` : p.path)).join("\n");
  }

  function parseLine(line: string): { path: string; maxDepth?: number } {
    const commaIdx = line.lastIndexOf(",");
    if (commaIdx !== -1) {
      const depthStr = line.slice(commaIdx + 1).trim();
      const depth = parseInt(depthStr, 10);
      if (!isNaN(depth) && depth > 0) {
        return { path: line.slice(0, commaIdx).trim(), maxDepth: depth };
      }
    }
    return { path: line };
  }

  async function handleSubmit(values: { text: string }) {
    const items = values.text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map(parseLine);
    await onSave(items);
    pop();
  }

  return (
    <Form
      navigationTitle="Edit All Paths"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Paths" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="text"
        title="Paths"
        placeholder={"~/projects\n~/work/*/src,3\n~/.config"}
        defaultValue={serialize(paths)}
        info="One path per line. Append ,N to set max depth (e.g. ~/projects/**/*,3)."
      />
    </Form>
  );
}

// --- Path Form ---

function PathForm({
  item,
  onSave,
}: {
  item?: PathItem;
  onSave: (path: string, maxDepth: number | undefined) => Promise<void>;
}) {
  const { pop } = useNavigation();
  const [pathText, setPathText] = useState(item?.path ?? "");

  async function handleSubmit(values: { pathText: string; maxDepth: string }) {
    const trimmed = values.pathText.trim();
    if (!trimmed) return;
    const parsed = parseInt(values.maxDepth.trim(), 10);
    const maxDepth = !isNaN(parsed) && parsed > 0 ? parsed : undefined;
    await onSave(trimmed, maxDepth);
    pop();
  }

  return (
    <Form
      navigationTitle={item ? "Edit Path" : "Add Search Path"}
      actions={
        <ActionPanel>
          <Action.SubmitForm title={item ? "Save Changes" : "Add Path"} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.FilePicker
        id="picker"
        title="Browse"
        allowMultipleSelection={false}
        canChooseFiles={false}
        canChooseDirectories
        onChange={(files) => files?.[0] && setPathText(files[0])}
      />
      <Form.TextField
        id="pathText"
        title="Path / Glob"
        placeholder="~/projects or ~/work/*/src"
        info="Supports glob patterns: * matches one level, ** matches any depth"
        value={pathText}
        onChange={setPathText}
      />
      <Form.TextField
        id="maxDepth"
        title="Max Depth"
        placeholder="optional, e.g. 3"
        defaultValue={item?.maxDepth?.toString() ?? ""}
        info="Limit how many levels deep to scan. Useful with ** patterns. Leave empty for no limit."
      />
    </Form>
  );
}
