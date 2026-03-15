# System Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Raycast Extension (macOS)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────┐         ┌──────────────────────────┐   │
│  │  OpenInApp Command   │         │  ManageApps Command      │   │
│  │  (Main Search UI)    │◄────────│  (Config CRUD UI)        │   │
│  └──────────────────────┘         └──────────────────────────┘   │
│         │ Search                            │ Update              │
│         ▼                                   ▼                      │
│  ┌──────────────────────────────────────────────────────┐        │
│  │              React Hooks (State Layer)               │        │
│  ├──────────────────────────────────────────────────────┤        │
│  │ useFolders()      → FolderItem[]                     │        │
│  │ useApps()         → AppConfig[]                      │        │
│  │ usePaths()        → PathItem[]                       │        │
│  │ useFrecency()     → frequency tracker                │        │
│  │ useLastApp()      → last 2 apps per folder           │        │
│  └──────────────────────────────────────────────────────┘        │
│         │ scan      │ rank    │ tiebreak  │ sort                 │
│         ▼           ▼         ▼           ▼                      │
│  ┌──────────────────────────────────────────────────────┐        │
│  │           Utility Functions (Logic Layer)            │        │
│  ├──────────────────────────────────────────────────────┤        │
│  │ useFolders()  ──glob()──> scan patterns + deduplicate        │
│  │ fuzzySearch() ──fuzzysort──> rank by query + tiebreaker      │
│  │ parseAlias()  ──split──> extract "alias query"               │
│  │ openInApp()   ──Raycast.open()──> launch app                 │
│  └──────────────────────────────────────────────────────┘        │
│         │ persist                                                 │
│         ▼                                                         │
│  ┌──────────────────────────────────────────────────────┐        │
│  │          Raycast LocalStorage (Data Layer)           │        │
│  ├──────────────────────────────────────────────────────┤        │
│  │ open-in-app:apps       → AppConfig[] (JSON)         │        │
│  │ open-in-app:paths      → PathItem[] (JSON)          │        │
│  │ open-in-app:frecency   → frequency counts (JSON)    │        │
│  │ open-in-app:last-app   → recent apps per folder     │        │
│  │ open-in-app:show-files → boolean toggle             │        │
│  └──────────────────────────────────────────────────────┘        │
│         │ read                                                    │
│         ▼                                                         │
│  ┌──────────────────────────────────────────────────────┐        │
│  │        Local Filesystem (Discovery Layer)            │        │
│  ├──────────────────────────────────────────────────────┤        │
│  │ ~/projects/                                          │        │
│  │ ~/work/*/src/          (glob patterns)               │        │
│  │ [with IGNORE list: node_modules, .git, etc]         │        │
│  └──────────────────────────────────────────────────────┘        │
│                                                                   │
│  ┌──────────────────────────────────────────────────────┐        │
│  │          Raycast API + System Integration            │        │
│  ├──────────────────────────────────────────────────────┤        │
│  │ getApplications()      → installed macOS apps        │        │
│  │ open(path, bundleId)   → launch app with path       │        │
│  │ showInFinder()         → reveal in Finder            │        │
│  │ getPreferences()       → defaultTerminal setting     │        │
│  │ LocalStorage API       → encrypted persistent store  │        │
│  └──────────────────────────────────────────────────────┘        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow: Search Query → Results → Open

```
User Types "ij react"
       │
       ▼
parseAlias("ij react")
├─ alias: "ij"
└─ query: "react"
       │
       ▼
fuzzySearch(folders, "react", "name", getFrequency)
├─ Input: [
│    { name: "react-app", path: "/..." },
│    { name: "react-native", path: "/..." },
│    { name: "vue-app", path: "/..." }
│  ]
├─ Fuzzy rank by name: "react-*" score > "vue-*" score
├─ Tiebreak by frequency: (freq[react-app] > freq[react-native])
└─ Output: [react-app, react-native, vue-app]
       │
       ▼
Render List.Item per folder
├─ Primary action: Open in IntelliJ (activeApp = "ij")
├─ Secondary action: Open in [last app used]
└─ Other actions: Open in [other configured apps]
       │
       ▼
User Presses Enter (or ⌘1 for IntelliJ)
       │
       ├─ trackOpen("/path/to/react-app")
       │  └─ frecency["/path/to/react-app"]++
       │
       ├─ setLastApp("/path/to/react-app", "ij-id")
       │  └─ lastApp["/path/to/react-app"] = { last: "ij-id", ... }
       │
       └─ openInApp("/path/to/react-app", intelij)
          └─ Raycast.open(path, "com.jetbrains.intellij")
             ↓
             macOS launches IntelliJ with folder as context
```

## Folder Scanning & Deduplication

```
Input paths:
  ├─ "~/projects"
  ├─ "~/work/*/src"
  └─ "~/repos/**"
       │
       ▼ (for each path)
expandTilde() → "/Users/schmas/projects", "/Users/schmas/work/*/src", ...
       │
       ▼
detect glob chars: *, ?, [, {, }
       │
    ├─ "~/projects" (no glob)
    │  └─ cwd="/Users/schmas/projects", pattern="*", maxDepth=1
    │
    ├─ "~/work/*/src" (has glob)
    │  ├─ Split at first glob: "~/work" + "*/src"
    │  └─ cwd="/Users/schmas/work", pattern="*/src", maxDepth=user-defined
    │
    └─ "~/repos/**" (has glob)
       ├─ Split at first glob: "~/repos" + "**"
       └─ cwd="/Users/schmas/repos", pattern="**", maxDepth=user-defined
            │
            ▼
       Safety check: if (cwd === "/") skip
       (prevents scanning entire disk)
            │
            ▼
       glob(pattern, { cwd, absolute: true, maxDepth, ignore: IGNORE })
            │
            ▼
       Matches: ["/path/a", "/path/b", "/path/c", ...]
            │
            ├─ Parallel Promise.all(stat() for each match)
            │  └─ Filter: isDirectory || includeFiles
            │
            ▼
       Aggregate all matches from all paths
            │
       (Deduplicate by path via Set)
            │
       Unique results: [FolderItem, FolderItem, ...]
            │
            ▼
       [Parallel is cancellable via cleanup function if deps change]
```

## Frecency Sorting Strategy

```
State: frecency map = { path: count }
Example: {
  "/Users/schmas/projects/react-app": 42,
  "/Users/schmas/projects/vue-app": 5,
  "/Users/schmas/projects/new-project": 0
}

Two modes:

MODE 1: User typed query (e.g., "react")
├─ fuzzySearch() ranks by match quality first
├─ Equal-score items tiebreak by frecency (higher first)
└─ Result: react-app (42) before vue-app (5) if scores equal

MODE 2: User did not type (empty query)
├─ Skip fuzzy ranking entirely
├─ sortByFrequency() returns items ordered by count DESC
└─ Result: react-app (42), vue-app (5), new-project (0)

Storage:
├─ trackOpen(path) increments count
├─ Max 500 entries; auto-prune top 500 by count
└─ Persisted to LocalStorage["open-in-app:frecency"]
```

## Last App Memory

```
State: lastAppMap = { folderPath: { last: id, secondLast?: id } }

Example:
{
  "/Users/schmas/projects/react-app": {
    last: "ij-id",
    secondLast: "code-id"
  },
  "/Users/schmas/projects/vue-app": {
    last: "code-id"
    // secondLast not set if only opened once
  }
}

Motivation:
├─ Most users open each folder in same app (IntelliJ for ij projects)
├─ Occasionally switch to secondary app (Terminal, VS Code)
└─ Remember last 2 to offer both without alias prefix

UI Integration:
├─ Primary action = last opened app
├─ Secondary action = 2nd last app (if different from primary)
├─ Remaining actions = other configured apps
└─ Aliases override all: if user types "code react", primary = VS Code

Migration:
├─ Old format: "id" (just string)
├─ New format: { last: "id", secondLast?: "id" }
└─ On load: migrateEntry() auto-upgrades old entries
```

## Storage & Corruption Recovery

```
┌─────────────────────────────────────────────────────────┐
│ Raycast LocalStorage (Raycast sandbox, encrypted disk)  │
└─────────────────────────────────────────────────────────┘
           │
    ┌──────┴──────┬──────────┬────────────┬────────────┐
    ▼             ▼          ▼            ▼            ▼
  apps          paths     frecency     last-app   show-files
  AppConfig[]   PathItem[] FreqMap     LastAppMap boolean

Load:
├─ getItem(key) → raw string
├─ JSON.parse(raw || '{}')
├─ if parse fails → removeItem(key) + reset to empty
└─ setData(parsed)

Mutation:
├─ Update in-memory dataRef + state
└─ await LocalStorage.setItem(key, JSON.stringify(updated))
   └─ Fire-and-forget; errors ignored

Why corruption happens:
├─ Raycast updates extension while data is persisted
├─ Unfinished write during app crash
├─ Manual editing of LocalStorage (unlikely)

Recovery:
├─ Try-catch on every load
├─ If JSON.parse fails → removeItem + reset
├─ UI shows empty state if hook fails
└─ User can reconfigure; no data loss (just reset)

Prevent corruption:
├─ Always use try-catch around JSON.parse
├─ Fire-and-forget persist (don't block UI)
├─ No validation on write (trust data is valid before JSON.stringify)
├─ Graceful degradation (missing hook data → empty state)
└─ Test with corrupted storage: manually set key to invalid JSON
```

## Hook Initialization Sequence

```
Component Mount
       │
       ├─ useApps()
       │  ├─ Load from LocalStorage
       │  └─ appsRef.current + state = parsed data
       │     └─ [now ready for UI]
       │
       ├─ usePaths()
       │  ├─ Load from LocalStorage
       │  └─ pathsRef.current + state = parsed data
       │     └─ [now ready for scanning]
       │
       ├─ useFolders(paths, showFiles)
       │  ├─ Subscribe to paths dependency
       │  ├─ For each path: expand → detect glob → glob() → stat() → dedupe
       │  └─ folders state + cleanup function
       │     └─ [ready to render]
       │
       ├─ useFrecency()
       │  ├─ Load frequency map from LocalStorage
       │  └─ freqRef.current = parsed map
       │     └─ [ready for tiebreaker]
       │
       └─ useLastApp()
          ├─ Load last app map from LocalStorage
          └─ mapRef.current = migrated map
             └─ [ready for primary action selection]

State Interdependencies:
├─ useFolders DEPENDS ON usePaths (paths → scan paths)
├─ fuzzySearch USES useFrecency (tiebreaker)
├─ List.Item USES useLastApp (primary action)
└─ Action USES useApps (icon, name)

Loading State:
├─ isLoading = pathsLoading || foldersLoading || appsLoading
└─ Wait for all to be false before rendering results
```

## Action Routing & App Selection

```
List of configured apps: [VSCode, IntelliJ, Sublime, Terminal]
                                                  └─ last: IntelliJ
                                                     secondLast: VSCode

User input: "react"      (no alias)
├─ activeApp = null
├─ primaryApp = lastApp || apps[0]
│              = IntelliJ
├─ secondaryApp = secondLastApp if different from primaryApp
│               = VSCode
└─ Actions rendered:
   1. Open in IntelliJ [⌘1]           (primary)
   2. Open in VSCode [⌘2]             (secondary)
   3. Open in Sublime [⌘3]            (tertiary)
   4. Open in Terminal [⌘T]           (section)
   5. Show in Finder [⌘F]             (section)
   6. Copy Path [⌘C]                  (section)

User input: "ij react"   (alias = "ij")
├─ activeApp = IntelliJ
├─ primaryApp = activeApp (IntelliJ)
├─ secondaryApp = null (activeApp overrides)
└─ Actions rendered:
   1. Open in IntelliJ [⌘1]           (primary - alias match)
   2. Open in VSCode [⌘2]             (other)
   3. Open in Sublime [⌘3]            (other)
   4. Open in Terminal [⌘T]           (section)
   5. Show in Finder [⌘F]             (section)
   6. Copy Path [⌘C]                  (section)

Shortcut precedence:
├─ Apps[0-8] get ⌘1 to ⌘9
├─ Terminal gets ⌘T (if configured)
├─ Finder gets ⌘F (native)
├─ Clipboard gets ⌘C (native)
└─ Manage gets ⌘⇧M
```

## Global Exclude List

Applied to all glob scans:

```
IGNORE = [
  "**/node_modules/**",    // npm, yarn, pnpm caches
  "**/.git/**",            // git repos
  "**/.hg/**",             // mercurial repos
  "**/.svn/**",            // subversion repos
  "**/dist/**",            // build outputs
  "**/.cache/**",          // general caches
  "**/__pycache__/**"      // python caches
]

Rationale:
├─ node_modules: 100k+ files, no user interest
├─ .git: internal metadata, broken symlinks
├─ dist: build output, not source
├─ cache: ephemeral, not projects
└─ Hardcoded, not user-configurable (prevents misconfiguration)

Future: Could expose as config if users request custom ignores
```

## Performance Optimization

```
Bottlenecks:
├─ Glob scanning (I/O bound, ~300-500ms for 1000 items)
├─ Fuzzy ranking (CPU bound, ~50-100ms for 1000 items)
└─ UI re-renders (DOM updates, ~10ms)

Mitigations:
├─ Glob scans run in parallel (Promise.all for all paths)
├─ useFolders cancels on dependency change (cleanup)
├─ Fuzzy search only runs if query non-empty
├─ Frecency tiebreaker avoids re-sorting (inline comparator)
├─ useRef prevents stale closures (no re-renders from ref changes)
└─ debounce? NO — Raycast handles this at input level

Scaling:
├─ 10 paths × 100 folders each = 1000 results → ~500ms scan
├─ Depth limits reduce folder count: maxDepth=2 → ~10-20% of unlimited
├─ User configures paths wisely (e.g., ~/projects not ~/)
└─ No caching between scans; re-scan on deps change
```

## Type Safety & Error Boundaries

```
React Error Boundary: NO (not implemented; Raycast handles crashes)

Error Handling:
├─ Storage loads
│  └─ Try-catch JSON.parse; reset to empty on fail
│
├─ Folder scans
│  ├─ Skip inaccessible paths (fs.promises.stat fails)
│  ├─ Skip invalid glob patterns
│  └─ No user toast; silent failure
│
├─ App selection
│  ├─ Validate alias exists before routing
│  └─ Fallback to apps[0] if no alias match
│
└─ Open action
   └─ Try-catch; show toast on failure
```

## Extensibility Points

Minimal coupling; could extend:

1. **Custom ignore patterns** — Per-path configuration instead of global IGNORE
2. **Frecency decay** — Time-weighted open tracking (recent > old)
3. **Workspace memory** — Remember open app per Raycast window/workspace
4. **Search history** — Quick access to recent searches
5. **Bulk import/export** — Backup/restore configurations
6. **App categories** — Tag apps (editors, terminals, tools) for filtering

None currently planned; focus on simplicity.
