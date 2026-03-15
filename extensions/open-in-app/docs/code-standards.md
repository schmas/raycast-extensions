# Code Standards & Patterns

## File Organization

### Directory Structure

```
src/
├── open-in-app.tsx          — Main command
├── manage-apps.tsx          — Management command
└── lib/
    ├── {hook-name}.ts       — React hooks (use-* pattern)
    └── {util-name}.ts       — Pure utilities
```

### Naming Conventions

| Entity           | Convention       | Example                                    |
| ---------------- | ---------------- | ------------------------------------------ |
| Files            | kebab-case       | `use-frecency.ts`, `parse-alias.ts`        |
| React components | PascalCase       | `OpenInApp`, `ManageApps`, `AppForm`       |
| Hooks            | `use{Name}`      | `useFrecency`, `useApps`, `usePaths`       |
| Variables        | camelCase        | `searchTerm`, `folderItem`, `isLoading`    |
| Constants        | UPPER_SNAKE_CASE | `STORAGE_KEY`, `MAX_ENTRIES`, `GLOB_CHARS` |
| Types/Interfaces | PascalCase       | `AppConfig`, `FolderItem`, `PathsHook`     |
| Local variables  | camelCase        | `expanded`, `matches`, `allFolders`        |

### File Size Guidelines

- **Target:** <150 LOC per file
- **Actual:** 11-378 LOC; larger files (open-in-app.tsx, manage-apps.tsx) justified by UI complexity
- **No further modularization planned** — Files already focused by responsibility

## React & Hook Patterns

### Hook Data Structure

All persistent data hooks follow this pattern:

```typescript
export interface DataHook {
  data: DataType[];
  isLoading: boolean;
  add: (item: Omit<DataType, 'id'>) => Promise<void>;
  update: (item: DataType) => Promise<void>;
  delete: (id: string) => Promise<void>;
}

export function useData(): DataHook {
  const [data, setData] = useState<DataType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const dataRef = useRef<DataType[]>([]);

  // 1. Load on mount with error recovery
  useEffect(() => {
    load();
  }, []);

  // 2. Persist helper
  async function persist(updated: DataType[]) {
    await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  // 3. Mutations update ref + state + persist
  async function add(item: Omit<DataType, 'id'>) {
    const updated = [...dataRef.current, { ...item, id: randomUUID() }];
    dataRef.current = updated;
    setData(updated);
    await persist(updated);
  }

  return { data, isLoading, add, update, delete };
}
```

**Why useRef + useState?**

- useRef ensures closures always see latest data (no stale captures)
- useState ensures UI re-renders on updates
- Double update (ref + state) maintains consistency

### Component Lifecycle

**On Mount:**

1. Initialize hooks (useFolders, useApps, usePaths, useFrecency, useLastApp)
2. Wait for all `isLoading` to be false
3. Render empty state if required data missing (no apps, no paths)
4. Otherwise render List with results

**On User Input:**

- `onSearchTextChange` → `setQuery` → re-filter via fuzzySearch
- `onAction` → track metrics (trackOpen, setLastApp) → call openInApp

**Cleanup:**

- useFolders returns cancellation function for glob scan
- useLastApp/useApps/useFrecency auto-cancel localStorage loads

### Props Patterns

**Shared Hooks:**

```typescript
// Pass hook instances to child components
export default function OpenInApp() {
  const appsHook = useApps();
  const pathsHook = usePaths();
  return <ManageApps sharedApps={appsHook} sharedPaths={pathsHook} />;
}
```

**Standalone Option:**

```typescript
export default function ManageApps({
  sharedApps, sharedPaths
}: { sharedApps?: AppConfigHook; sharedPaths?: PathsHook } = {}) {
  if (sharedApps && sharedPaths) {
    return <ManageAppsCore appsHook={sharedApps} pathsHook={sharedPaths} />;
  }
  return <StandaloneManageApps />;
}
```

Allows both:

- Nested use (ManageApps called from OpenInApp with shared state)
- Standalone use (ManageApps launched directly)

## Storage Patterns

### LocalStorage Keys

All keys prefixed with `open-in-app:` to avoid collisions:

```typescript
const STORAGE_KEY = "open-in-app:apps";
const STORAGE_KEY = "open-in-app:paths";
const STORAGE_KEY = "open-in-app:frecency";
const STORAGE_KEY = "open-in-app:last-app";
const STORAGE_KEY = "open-in-app:show-files";
```

### Corruption Recovery

Every localStorage access wrapped in try/catch:

```typescript
async function load() {
  const raw = await LocalStorage.getItem<string>(STORAGE_KEY);
  try {
    const parsed = JSON.parse(raw || "{}");
    setData(parsed);
  } catch {
    // Corrupted — reset
    await LocalStorage.removeItem(STORAGE_KEY);
    setData([]);
  }
}
```

### Persistence Pattern

Immediate persistence on every mutation:

```typescript
async function add(item) {
  const updated = [...dataRef.current, item];
  dataRef.current = updated;
  setData(updated);
  await persist(updated); // Fire-and-forget; no error handling needed
}
```

## Search & Filtering Patterns

### Query Parsing

```typescript
const { alias, query: searchTerm } = parseAlias(input);
const activeApp = alias ? apps.find((a) => a.alias === alias) : null;
```

### Fuzzy Ranking with Tiebreaker

```typescript
const frecencyTiebreaker = (item: { path: string }) => getFrequency(item.path);
const filtered = fuzzySearch(folders, searchTerm, "name", frecencyTiebreaker);
const results = searchTerm ? filtered : sortByFrequency(filtered);
```

**Logic:**

- If user typed query: fuzzy-rank by match quality, tiebreak on frequency
- If query empty: sort purely by frequency (most-used first)

### Glob Pattern Handling

```typescript
const expanded = expandTilde(path);
const hasGlob = /[*?[\]{}]/.test(expanded);

if (hasGlob) {
  const parts = expanded.split("/");
  const firstGlobIdx = parts.findIndex((p) => GLOB_CHARS.test(p));
  const cwd = parts.slice(0, firstGlobIdx).join("/") || "/";

  // Skip if pattern base is filesystem root
  if (cwd === "/") continue;

  const pattern = parts.slice(firstGlobIdx).join("/");
  const matches = await glob(pattern, { cwd, maxDepth, ignore: IGNORE });
}
```

## Error Handling

### UI-Level Errors

```typescript
try {
  await trackOpen(folder.path);
  await openInApp(folder.path, app);
} catch (e) {
  await showToast({
    style: Toast.Style.Failure,
    title: "Failed to open",
    message: String(e),
  });
}
```

### Storage Errors

- Silent recovery (no toasts) on load errors; just reset to empty
- Persistence never awaited in success path (fire-and-forget)
- Errors during persist don't propagate to user

### Path Accessibility Errors

```typescript
try {
  const stat = await fs.promises.stat(match);
  // Process stat...
} catch {
  // Skip inaccessible paths — no error toast
}
```

## Keyboard Shortcuts

### Action Shortcuts (Dynamic)

```typescript
function appShortcut(index: number) {
  const SHORTCUT_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;
  return index < SHORTCUT_KEYS.length
    ? { modifiers: ["cmd"], key: SHORTCUT_KEYS[index] }
    : undefined;
}

// Usage
<Action
  shortcut={appShortcut(apps.findIndex(a => a.id === primaryApp.id))}
  onAction={...}
/>
```

**Note:** Only first 9 apps get shortcuts; additional apps accessible via action panel only.

## Form Validation

### Alias Validation

```typescript
const alias = values.alias.trim();
if (!alias) {
  await showToast({ style: Toast.Style.Failure, title: "Alias is required" });
  return;
}
if (alias.includes(" ")) {
  await showToast({ style: Toast.Style.Failure, title: "Alias cannot contain spaces" });
  return;
}
const duplicate = existingApps.find((a) => a.alias === alias && a.id !== app?.id);
if (duplicate) {
  await showToast({
    style: Toast.Style.Failure,
    title: `Alias "${alias}" is already used by ${duplicate.name}`,
  });
  return;
}
```

### Depth Validation

```typescript
const parsed = parseInt(values.maxDepth.trim(), 10);
const maxDepth = !isNaN(parsed) && parsed > 0 ? parsed : undefined;
```

## Type Safety

### Generic Utilities

```typescript
// Fuzzy search generic over item type
export function fuzzySearch<T>(
  items: T[],
  query: string,
  key: keyof T,
  tiebreaker?: (item: T) => number,
): T[] { ... }

// Sort generic over items with path property
interface HasPath { path: string; }
function sortByFrequency<T extends HasPath>(items: T[]): T[] { ... }
```

### Discriminated Unions (None used currently)

Future enhancement for multiple action types; currently all actions return void.

## Import Organization

**Pattern:**

1. Raycast API imports (named)
2. React imports (named + default)
3. Internal imports (relative paths, lib first, then siblings)

```typescript
import { Action, List, LocalStorage } from "@raycast/api";
import { useEffect, useState } from "react";
import { fuzzySearch } from "./lib/fuzzy-search";
import { useApps } from "./lib/use-apps";
import ManageApps from "./manage-apps";
```

## No Linting Strictness

- ESLint runs on pre-commit (auto-fix enabled)
- Prettier formats code
- No strict type checking required (functional correctness prioritized)
- Grammar/style warnings ignored in favor of readability

## Comments & Documentation

### When to Comment

- **Non-obvious logic:** Glob pattern splitting, frecency tie-breaking
- **Workarounds:** Root filesystem safety check
- **Migration logic:** Last app history format upgrade

### Example

```typescript
// Skip patterns whose base resolves to filesystem root to avoid scanning entire disk
if (cwd === "/") continue;
```

### Avoid

- Obvious code: `const name = folder.name; // Get folder name`
- Dead comments: Updated often; prefer self-documenting code

## Async/Await

**Consistency:**

- Use async/await, not .then() chains
- Fire-and-forget ok for logging, persistence; otherwise await

```typescript
// Fire-and-forget (no error handling needed)
await trackOpen(folder.path);

// Await and handle errors
try {
  await openInApp(folder.path, app);
} catch (e) {
  await showToast({ style: Toast.Style.Failure, message: String(e) });
}
```

## No Mocking or Fake Data

- All data integrates with real Raycast APIs
- Tests run in dev mode interactively
- No mock localStorage, mock file system, or synthetic data
