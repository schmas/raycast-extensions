<!-- Parent: ../AGENTS.md -->

# src/lib/ — Utility & Hook Layer

**Generated:** 2026-03-11 | **Commit:** 952eda5 | **Branch:** main

## Purpose

The `lib/` directory contains all business logic, data management, and utility functions used by both commands. This layer abstracts Raycast API, LocalStorage, glob scanning, and search ranking behind clean interfaces.

## Key Files

| File              | Type | Purpose                                  | Exports                                   | Lines |
| ----------------- | ---- | ---------------------------------------- | ----------------------------------------- | ----- |
| `use-apps.ts`     | Hook | App config CRUD via LocalStorage         | `useApps()`, `AppConfig` interface        | 72    |
| `use-paths.ts`    | Hook | Search path CRUD via LocalStorage        | `usePaths()`, `PathItem`, `displayPath()` | 90    |
| `use-folders.ts`  | Hook | Scan paths with glob, return folder list | `useFolders()`, `FolderItem` interface    | 102   |
| `use-frecency.ts` | Hook | Track open frequency, sort by usage      | `useFrecency()`                           | 47    |
| `parse-alias.ts`  | Util | Parse "ij react" → {alias, query}        | `parseAlias()`                            | 15    |
| `fuzzy-search.ts` | Util | Fuzzy-rank items by key field            | `fuzzySearch()`                           | 13    |
| `open-in-app.ts`  | Util | Execute open action via Raycast          | `openInApp()`                             | 11    |

## Hooks (React Stateful)

### `use-apps.ts` — AppConfig Management

**Interface:**

```tsx
useApps(): {
  apps: AppConfig[];
  isLoading: boolean;
  addApp(data: Omit<AppConfig, "id">): Promise<void>;
  updateApp(app: AppConfig): Promise<void>;
  deleteApp(id: string): Promise<void>;
}
```

**Data Structure:**

```tsx
interface AppConfig {
  id: string; // UUID
  alias: string; // e.g. "ij" (used in search)
  name: string; // e.g. "IntelliJ IDEA"
  bundleId: string; // e.g. "com.jetbrains.intellij"
  appPath?: string; // macOS .app path (optional, for icons)
}
```

**Storage:** Raycast LocalStorage key `"open-in-app:apps"` (JSON array)

**Behavior:**

- Loads on mount, synchronously updates state + persists to LocalStorage
- Generates UUID for new apps
- Handles JSON corruption gracefully (clears storage, resets state)

**Used By:** `open-in-app.tsx`, `manage-apps.tsx`

---

### `use-paths.ts` — Search Path Management

**Interface:**

```tsx
usePaths(): {
  paths: PathItem[];
  isLoading: boolean;
  addPath(path: string): Promise<void>;
  updatePath(id: string, newPath: string): Promise<void>;
  deletePath(id: string): Promise<void>;
  movePath(id: string, direction: "up" | "down"): Promise<void>;
}
```

**Data Structure:**

```tsx
interface PathItem {
  id: string; // UUID
  path: string; // ~ or absolute, may contain glob chars
  // e.g. "~/projects" or "~/work/*/src"
}
```

**Utility:**

```tsx
function displayPath(p: string): string;
// Shorten absolute paths: /Users/user/... → ~/...
```

**Storage:** Raycast LocalStorage key `"open-in-app:paths"` (JSON array)

**Behavior:**

- Ordered array (reorderability via `movePath`)
- Supports glob patterns in path string
- Home directory (~) auto-expanded at scan time
- Handles corruption gracefully

**Used By:** `open-in-app.tsx`, `manage-apps.tsx`, `use-folders.ts`

---

### `use-folders.ts` — Directory Scanning

**Interface:**

```tsx
useFolders(searchPaths: string[]): {
  folders: FolderItem[];
  isLoading: boolean;
}
```

**Data Structure:**

```tsx
interface FolderItem {
  name: string; // basename
  path: string; // full absolute path
  displayPath: string; // tilde-shortened for display
}
```

**Scanning Logic:**

- Expands `~` to home directory
- If path contains glob chars (`*`, `?`, `[`, `]`, `{`, `}`):
  - Uses glob pattern directly
  - Example: `~/work/*/src` matches all depth-1 subdirs under ~/work/\*/src
- If path is plain directory:
  - Scans immediate children only (maxDepth: 1)
  - Example: `~/projects` returns all top-level folders in ~/projects
- Filters directories only (skips files)
- Ignores system/build directories:
  - `node_modules`, `.git`, `.hg`, `.svn`, `dist`, `.cache`, `__pycache__`

**Error Handling:**

- Invalid glob patterns silently skipped
- Inaccessible paths silently skipped
- Runs in parallel via `Promise.all()`

**Storage:** None (computed on demand)

**Dependencies:**

- `glob` package (v10.4.5) — glob pattern expansion
- `fs.promises.stat()` — check if path is directory

**Used By:** `open-in-app.tsx`

---

### `use-frecency.ts` — Usage Frequency Tracking

**Interface:**

```tsx
useFrecency(): {
  sortByFrequency<T extends { path: string }>(items: T[]): T[];
  trackOpen(path: string): void;
}
```

**Storage:** Raycast LocalStorage key `"open-in-app:frecency"` (JSON object)

**Data Structure:**

```tsx
type FreqMap = Record<string, number>;
// { "/path/to/folder": 5, "/path/to/other": 2 }
```

**Behavior:**

- Loads frequency map on mount
- `trackOpen(path)` increments count, persists to LocalStorage
- `sortByFrequency(items)` sorts descending by count
- Returns original order if frequency map empty (no opens yet)
- Uses `useRef` to keep closure updated with latest frequency data

**Pattern Note:** useRef prevents stale closures in trackOpen callback

**Used By:** `open-in-app.tsx`

---

## Utilities (Pure Functions)

### `parse-alias.ts` — Query String Parser

**Function:**

```tsx
parseAlias(input: string): { alias: string | null; query: string }
```

**Logic:**

- Looks for space character in input
- If space found: first word is alias, remainder is query
- If no space: entire input is query (alias = null)

**Examples:**

```
"ij react"     → { alias: "ij", query: "react" }
"ijproject"    → { alias: null, query: "ijproject" }
"react"        → { alias: null, query: "react" }
" leading"     → { alias: "", query: "leading" }
```

**Used By:** `open-in-app.tsx` (parse search bar input)

---

### `fuzzy-search.ts` — Fuzzy Matching & Ranking

**Function:**

```tsx
fuzzySearch<T>(items: T[], query: string, key: keyof T): T[]
```

**Logic:**

- Returns all items if query is empty
- Uses `fuzzysort` library to rank matches by similarity
- Returns results sorted by best match first

**Dependencies:**

- `fuzzysort` (v3.1.0) — fuzzy ranking algorithm

**Used By:** `open-in-app.tsx` (search bar filtering)

---

### `open-in-app.ts` — App Launch Wrapper

**Function:**

```tsx
openInApp(filePath: string, app: AppConfig): Promise<void>
```

**Logic:**

- Wraps Raycast `open()` API
- Uses `AppConfig.bundleId` for precise app targeting

**Dependencies:**

- `@raycast/api` — `open()` function

**Used By:** `open-in-app.tsx` (action handlers)

---

---

**Parent:** [`../AGENTS.md`](../AGENTS.md) | **Root:** [`../../AGENTS.md`](../../AGENTS.md)
