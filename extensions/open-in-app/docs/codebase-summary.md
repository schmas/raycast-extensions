# Codebase Summary

## Overview

**10 TypeScript files** (~1000 LOC) organized into 2 commands + 8 utility hooks.

```
src/
├── open-in-app.tsx (271 LOC)    — Main search command
├── manage-apps.tsx (378 LOC)    — Management UI + forms
└── lib/
    ├── fuzzy-search.ts (17 LOC)      — Fuzzy ranking with tiebreaker
    ├── open-in-app.ts (11 LOC)       — Raycast open() wrapper
    ├── parse-alias.ts (14 LOC)       — Split alias from search query
    ├── use-apps.ts (87 LOC)          — App config CRUD hook
    ├── use-folders.ts (137 LOC)      — Folder scanning hook
    ├── use-frecency.ts (63 LOC)      — Frequency tracking hook
    ├── use-last-app.ts (62 LOC)      — Last 2 apps per folder hook
    └── use-paths.ts (114 LOC)        — Path config CRUD hook
```

## File Responsibilities

### UI Commands

#### `open-in-app.tsx` (271 LOC)

**Purpose:** Main search & open command
**Exports:** Default component + helpers

**Key Components:**

- `OpenInApp()` — Main component; assembles all hooks, renders results, handles actions
- `ManageAction()` — Navigates to manage-apps command
- `useAppIconResolver()` — Lazy-loads app icons from `getApplications()`

**Data Flow:**

```
query input
  ↓
parseAlias() → { alias?, searchTerm }
  ↓
useFolders(paths) → FolderItem[]
  ↓
fuzzySearch(folders, searchTerm) → ranked results
  ↓
sortByFrequency (if no query) → freq-sorted results
  ↓
List.Item per folder → ActionPanel with all apps
  ↓
onAction: trackOpen() → setLastApp() → openInApp()
```

**Keyboard Shortcuts:**
| Shortcut | Action |
|----------|--------|
| `⌘⇧M` | Open Manage Apps & Paths |
| `⌘T` | Open in terminal |
| `⌘F` | Show in Finder |
| `⌘C` | Copy path |
| `⌘.` | Toggle file display |
| `⌘[1-9]` | App shortcuts |

#### `manage-apps.tsx` (378 LOC)

**Purpose:** Configuration UI for apps and search paths
**Exports:** Standalone + shared mode components

**Components:**

- `ManageApps()` — Router; detects shared vs. standalone mode
- `ManageAppsCore()` — Main management view with two sections
- `AppForm()` — Add/edit app (alias validation, app picker)
- `PathForm()` — Add/edit single path with depth control
- `PathsBulkForm()` — Bulk edit all paths (one per line, CSV depth format)

**Features:**

- Drag reordering via moveApp/movePath
- Confirmation dialogs before delete
- File browser for path selection
- Alias uniqueness validation
- Depth limit info text

### Utility Hooks

#### `use-apps.ts` (87 LOC)

**Purpose:** App configuration CRUD + persistence
**Exports:** `useApps()` hook + `AppConfig` interface

**Interfaces:**

```typescript
AppConfig {
  id: string           // UUID
  alias: string        // "ij", "code", etc.
  name: string         // "IntelliJ IDEA"
  bundleId: string     // "com.jetbrains.intellij" or app path
  appPath?: string     // macOS .app path for icons
}

AppConfigHook {
  apps: AppConfig[]
  isLoading: boolean
  addApp(data) → Promise<void>
  updateApp(app) → Promise<void>
  deleteApp(id) → Promise<void>
  moveApp(id, direction) → Promise<void>
}
```

**Implementation:**

- `appsRef.current` maintains in-memory cache to avoid stale closures
- `LocalStorage.setItem(STORAGE_KEY)` persists all changes immediately
- Corruption recovery: catches JSON.parse errors, resets to empty

**Storage Key:** `open-in-app:apps`

#### `use-paths.ts` (114 LOC)

**Purpose:** Search path CRUD + persistence
**Exports:** `usePaths()` hook + `PathItem` interface + `displayPath()` helper

**Interfaces:**

```typescript
PathItem {
  id: string              // UUID
  path: string            // "~/projects", "~/work/*/src"
  maxDepth?: number       // Optional depth limit
}

PathsHook {
  paths: PathItem[]
  isLoading: boolean
  addPath(path, maxDepth) → Promise<void>
  updatePath(id, newPath, maxDepth) → Promise<void>
  deletePath(id) → Promise<void>
  movePath(id, direction) → Promise<void>
  replacePaths(items) → Promise<void>  // Bulk edit
}
```

**Key Functions:**

- `displayPath(p)` — Converts `/Users/schmas/projects` → `~/projects`
- `replacePaths()` — Merges old + new, preserves IDs by path

**Storage Key:** `open-in-app:paths`

#### `use-folders.ts` (137 LOC)

**Purpose:** Folder discovery via glob patterns
**Exports:** `useFolders()` hook + `FolderItem` interface

**Interfaces:**

```typescript
FolderItem {
  name: string         // "react-app"
  path: string         // "/Users/schmas/projects/react-app"
  displayPath: string  // "~/projects/react-app"
  isDirectory: boolean // true if dir, false if file
}

FolderHook {
  folders: FolderItem[]
  isLoading: boolean
}
```

**Glob Logic:**

1. Split expanded path at first glob char (`*`, `?`, `[`, `{`, `}`)
2. Part before glob = cwd; part after = pattern
3. Skip if cwd resolves to `/` (prevents disk-wide scans)
4. Call `glob(pattern, { cwd, absolute: true, maxDepth, ignore: IGNORE })`
5. Deduplicate by path, stat each to confirm type

**IGNORE List:**

```
node_modules, .git, .hg, .svn, dist, .cache, __pycache__
```

**Performance:**

- Parallel `Promise.all()` for all stat calls
- Deduplication via Set after all paths collected
- Cancellation via cleanup function

#### `use-frecency.ts` (63 LOC)

**Purpose:** Track and sort by folder open frequency
**Exports:** `useFrecency()` hook

**Interface:**

```typescript
FrecencyHook {
  sortByFrequency<T>(items: T[]) → T[]  // Returns sorted by freq desc
  getFrequency(path) → number            // Returns open count
  trackOpen(path) → Promise<void>        // Increment counter
}
```

**Implementation:**

- `freqRef.current` stores `{ [path]: count }` in memory
- Loads from LocalStorage on mount
- Auto-prunes to max 500 entries (keeps top 500 by count)
- Sort secondary by descending frequency on ties in fuzzy search

**Storage Key:** `open-in-app:frecency`

#### `use-last-app.ts` (62 LOC)

**Purpose:** Remember last 2 apps opened per folder
**Exports:** `useLastApp()` hook

**Interface:**

```typescript
LastAppHook {
  getLastApp(folderPath) → string | null       // ID of most recent
  getSecondLastApp(folderPath) → string | null // ID of 2nd recent
  setLastApp(folderPath, appId) → Promise<void>
}
```

**Data Structure:**

```typescript
type LastAppMap = Record<string, { last: string; secondLast?: string }>;
```

**Migration:**

- Old format: string (just last app ID)
- New format: object with `{ last, secondLast }`
- Auto-migrates on load

**Storage Key:** `open-in-app:last-app`

#### `fuzzy-search.ts` (17 LOC)

**Purpose:** Rank search results with optional tiebreaker
**Exports:** `fuzzySearch()` utility

**Function Signature:**

```typescript
fuzzySearch<T>(
  items: T[],
  query: string,
  key: keyof T,
  tiebreaker?: (item: T) => number
) → T[]
```

**Logic:**

- Empty query → return all items unranked
- Non-empty query → `fuzzysort.go()` ranking
- With tiebreaker → re-sort equal-score items by tiebreaker (higher first)
- Always returns best matches first

#### `parse-alias.ts` (14 LOC)

**Purpose:** Extract alias prefix from search input
**Exports:** `parseAlias()` utility

**Function Signature:**

```typescript
parseAlias(input: string) → { alias: string | null; query: string }
```

**Examples:**

```
"ij react"       → { alias: "ij", query: "react" }
"ijproject"      → { alias: null, query: "ijproject" }
"react"          → { alias: null, query: "react" }
""               → { alias: null, query: "" }
```

#### `open-in-app.ts` (11 LOC)

**Purpose:** Wrapper around Raycast `open()` API
**Exports:** `openInApp()` utility

**Function Signature:**

```typescript
openInApp(filePath: string, app: AppConfig) → Promise<void>
```

**Implementation:** Single-line call to `open(filePath, app.bundleId)`

## Data Storage Schema

All data stored as JSON in Raycast LocalStorage:

| Key                      | Format                               | Max Size         | Pruning            |
| ------------------------ | ------------------------------------ | ---------------- | ------------------ |
| `open-in-app:apps`       | `AppConfig[]`                        | ~10KB (100 apps) | None               |
| `open-in-app:paths`      | `PathItem[]`                         | ~5KB (50 paths)  | None               |
| `open-in-app:frecency`   | `Record<path, count>`                | ~50KB            | Auto-prune top 500 |
| `open-in-app:last-app`   | `Record<path, { last, secondLast }>` | ~20KB            | None               |
| `open-in-app:show-files` | `"true"` \| `"false"`                | 10B              | None               |

**Corruption Recovery:**

- Each hook wraps localStorage access in try/catch
- On JSON.parse error → removeItem(key) and reset to empty state
- No cascading failures; UI shows empty state if any hook fails to load

## Type Definitions

**Key Types:**

```typescript
// App config
type AppConfig = {
  id: string; alias: string; name: string;
  bundleId: string; appPath?: string;
}

// Search path
type PathItem = { id: string; path: string; maxDepth?: number }

// Folder result
type FolderItem = {
  name: string; path: string; displayPath: string; isDirectory: boolean;
}

// Raycast preference
interface Preferences.OpenInApp { defaultTerminal?: Application }
interface Preferences.ManageApps { defaultTerminal?: Application }
```

## Dependencies

| Package          | Version  | Purpose                            |
| ---------------- | -------- | ---------------------------------- |
| `@raycast/api`   | ^1.104.9 | Raycast SDK (UI, storage, actions) |
| `@raycast/utils` | ^1.17.0  | Raycast utilities                  |
| `fuzzysort`      | ^3.1.0   | Fuzzy search ranking               |
| `glob`           | ^10.4.5  | Glob pattern matching              |
| `@types/node`    | 22.13.10 | Node.js types                      |
| `@types/react`   | 19.0.10  | React types                        |
| `typescript`     | ^5.8.2   | TS compiler                        |
| `eslint`         | ^9.22.0  | Linting                            |
| `prettier`       | ^3.5.3   | Formatting                         |
| `husky`          | ^9.1.7   | Git hooks                          |
| `lint-staged`    | ^16.3.3  | Pre-commit linting                 |

## Common Patterns

### useRef + useState Combo

All data hooks use this pattern to avoid stale closures:

```typescript
const [data, setData] = useState(initial);
const dataRef = useRef(initial);

// In async handlers, use dataRef.current
// Update both ref + state for consistency
```

### LocalStorage Persistence

```typescript
async function persist(data) {
  await LocalStorage.setItem(KEY, JSON.stringify(data));
}

// Load on mount with error handling
useEffect(() => {
  LocalStorage.getItem(KEY).then((raw) => {
    try {
      const parsed = JSON.parse(raw || "{}");
      dataRef.current = parsed;
      setData(parsed);
    } catch {
      // Reset to empty
      LocalStorage.removeItem(KEY);
    }
  });
}, []);
```

### Glob Pattern Parsing

```typescript
const expanded = expandTilde(path); // ~/projects → /Users/schmas/projects
const hasGlob = /[*?[\]{}]/.test(expanded);
if (hasGlob) {
  // Split at first glob char
  const parts = expanded.split("/");
  const firstGlobIdx = parts.findIndex((p) => GLOB_CHARS.test(p));
  const cwd = parts.slice(0, firstGlobIdx).join("/");
  const pattern = parts.slice(firstGlobIdx).join("/");
}
```

## Performance Characteristics

| Operation          | Complexity | Latency (1000 folders) |
| ------------------ | ---------- | ---------------------- |
| Folder scan (glob) | O(n)       | ~300-500ms             |
| Fuzzy search       | O(n log n) | ~50-100ms              |
| Frecency sort      | O(n log n) | ~10ms                  |
| Memory (all data)  | O(n)       | ~5-10MB                |

## Testing & Linting

**Pre-commit hooks** (husky + lint-staged):

- ESLint on `*.ts/*.tsx` with auto-fix
- Prettier on `*.ts/*.tsx/*.json/*.md` with auto-format

**No automated tests** — Raycast CLI dev mode provides interactive testing.

## Build & Distribution

- `npm run build` → `ray build` (creates `.raycast` archive)
- `npm run dev` → `ray develop` (hot-reload dev mode)
- `npm run publish` → `ray publish` (publish to Raycast Store)
- Pre-publish validation via `prepublishOnly` script
