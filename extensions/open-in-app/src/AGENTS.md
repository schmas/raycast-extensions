<!-- Parent: ../AGENTS.md -->

# src/ — Command Layer

**Generated:** 2026-03-11 | **Commit:** 952eda5 | **Branch:** main

## Purpose

The `src/` directory contains the two Raycast commands that form the user-facing interface:

1. **`open-in-app.tsx`** — Main search command with fuzzy-find and app selection
2. **`manage-apps.tsx`** — Management command for CRUD operations on apps and paths

Both commands import and compose hooks/utilities from `lib/` to handle data and execution logic.

## Key Files

| File              | Type    | Purpose                                                  | Lines |
| ----------------- | ------- | -------------------------------------------------------- | ----- |
| `open-in-app.tsx` | Command | Main search: fuzzy-find folders, parse alias, select app | 150   |
| `manage-apps.tsx` | Command | CRUD UI: add/edit/remove apps and search paths           | 210   |

## Command: open-in-app.tsx

**Entry Point:** Default export `OpenInApp` component

**Responsibilities:**

- Display Raycast List with search bar (alias + query format)
- Load folders from configured paths via `useFolders()`
- Parse user input with `parseAlias()` (e.g., "ij react" → alias=ij, query=react)
- Fuzzy-search folders via `fuzzySearch()`
- Sort by frecency when no query active
- Generate action buttons for each app + terminal + finder
- Track opens via `trackOpen()` for frecency calculation

**Key Dependencies:**

- `usePaths()` — configured search paths
- `useFolders(paths)` — scanned folders from paths
- `useApps()` — configured app targets
- `useFrecency()` — sort by frequency + track opens
- `parseAlias()` — parse "ij react" format
- `fuzzySearch()` — rank matching folders
- `openInApp()` — execute open action
- `useAppIconResolver()` — resolve app icons at runtime

**Preferences Used:**

- `defaultTerminal` (appPicker) — Terminal app for shell opens

**Empty States:**

- No apps configured → show setup prompt (⌘⇧M)
- No paths configured → show setup prompt (⌘⇧M)

**Actions (per folder):**

- Primary: Open in alias-matched app (if alias provided)
- Secondary: Open in remaining apps (sorted)
- Terminal: Open in default terminal (if configured)
- Finder: Show in Finder
- Management: Link to manage-apps (⌘⇧M)

## Command: manage-apps.tsx

**Entry Point:** Default export `ManageApps` component

**Responsibilities:**

- Display two List sections: Apps + Search Paths
- Add app via `AppForm` (alias + app picker)
- Edit app via `AppForm`
- Delete app with confirmation
- Add search path via `PathForm` (file picker + glob support)
- Edit search path via `PathForm`
- Remove search path with confirmation
- Reorder paths (move up/down)

**Key Dependencies:**

- `useApps()` — CRUD: addApp, updateApp, deleteApp
- `usePaths()` — CRUD: addPath, updatePath, deletePath, movePath
- `getApplications()` — list installed apps for dropdown
- `displayPath()` — shorten paths for UI display

**Subcomponents:**

### AppForm

Editable form for app configuration.

**Fields:**

- `alias` (text) — short prefix (e.g., "ij", "code")
- `appId` (dropdown) — installed app selection

**Validation:**

- Alias not empty, no spaces
- App selected

**On Save:** Stores full app config (name, bundleId, appPath) to LocalStorage

### PathForm

Editable form for search path configuration.

**Fields:**

- `picker` (file picker) — browse and populate path field
- `pathText` (text) — full path/glob (editable)

**Info:**

- Supports glob patterns: `*` (one level), `**` (any depth)
- Example: `~/projects` or `~/work/*/src`

**On Save:** Stores path string to LocalStorage, will be scanned on next load

## Subdirectory

### `lib/` — Utility and Hook Layer

See [`lib/AGENTS.md`](./lib/AGENTS.md) for business logic, hooks, and utilities.

## For AI Agents

### When Modifying Commands

1. **Adding search filters or display options:**
   - Edit component state in `open-in-app.tsx`
   - Update List item rendering

2. **Adding app configuration fields:**
   - Extend `AppConfig` interface in `use-apps.ts`
   - Add new `Form.Field*` in `AppForm`
   - Update form submission handling

3. **Adding search path features (e.g., ignore patterns):**
   - Extend `PathItem` interface in `use-paths.ts`
   - Add new `Form.Field*` in `PathForm`
   - Pass new config to `useFolders()` for scanning logic

4. **Changing UI layout or actions:**
   - Edit Raycast List/Form structure directly
   - Import action helpers from `@raycast/api`

### Common Patterns in Commands

**Loading Multiple Data Sources:**

```tsx
const { data: item1, isLoading: loading1 } = useHook1();
const { data: item2, isLoading: loading2 } = useHook2();
const isLoading = loading1 || loading2;
```

**Confirmation Dialog:**

```tsx
const confirmed = await confirmAlert({
  title: `Delete "${item.name}"?`,
  primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
});
if (confirmed) {
  /* execute delete */
}
```

**App Icon Resolution (Dynamic):**

```tsx
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
```

### File Structure

- Commands are React functional components with Raycast JSX
- Imported hooks from `lib/` provide data and CRUD operations
- Each command should remain <250 lines (break subcomponents if needed)
- Form subcomponents extracted for reusability

---

**Parent:** [`../AGENTS.md`](../AGENTS.md) | **Next:** [`lib/AGENTS.md`](./lib/AGENTS.md)
