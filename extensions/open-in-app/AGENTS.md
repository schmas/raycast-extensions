# Open in App - Agent Navigation Guide

**Generated:** 2026-03-11 | **Commit:** 952eda5 | **Branch:** main

## Purpose

This project is a Raycast extension for macOS that enables fuzzy-searching and opening folders/projects in configured applications. The extension provides two commands: the main search interface (`open-in-app`) and a management UI for configuring apps and search paths (`manage-apps`).

**Core Functionality:**
- Fuzzy search folders across configured paths with alias-based app targeting
- CRUD management of app configurations and search paths
- Frecency-based result sorting by usage frequency
- Integration with Raycast API for app icons and system preferences

## Key Files

| File | Purpose | Key Exports |
|------|---------|-------------|
| `package.json` | Raycast extension manifest, dependencies, build scripts | Extension config, 2 commands, 1 preference |
| `tsconfig.json` | TypeScript configuration | Strict mode enabled, es2020 target |
| **Commands** |
| `src/open-in-app.tsx` | Main search command: fuzzy-finds folders and opens in configured apps | Default export, 150 lines |
| `src/manage-apps.tsx` | Management command: CRUD UI for apps and search paths | Default export, AppForm, PathForm components |

## Subdirectories

### `src/lib/` — Core Business Logic (Utilities & Hooks)

Utility modules and React hooks that power both commands.

**See:** [`src/lib/AGENTS.md`](./src/lib/AGENTS.md)

## Architecture Overview

```
┌─ User Input (Search Bar)
│   ├─ parseAlias(query) → {alias, searchTerm}
│   └─ fuzzySearch(folders, searchTerm) → ranked FolderItem[]
│
├─ Data Layer (Raycast LocalStorage)
│   ├─ useApps() → AppConfig[] (alias, bundleId, icon)
│   ├─ usePaths() → PathItem[] (glob patterns)
│   └─ useFolders(paths) → FolderItem[] (scanned directories)
│
├─ Frecency Tracking
│   └─ useFrecency() → sortByFrequency(), trackOpen()
│
└─ Execution (Raycast API)
    └─ openInApp(path, app) → Raycast.open()
```

**Key Decisions:**
- All config stored in Raycast LocalStorage (not preferences file)
- `defaultTerminal` app stored as Raycast `appPicker` preference
- Glob patterns supported in search paths (*, **, node_modules excluded)
- App icons resolved at runtime via `getApplications()` lookup
- Frecency based on open count, sorted when no query active

## For AI Agents

### When Implementing Features

1. **Command-Level Changes** (main search, management UI):
   - Edit `src/open-in-app.tsx` or `src/manage-apps.tsx`
   - Coordinate with hooks in `src/lib/`

2. **Utility/Hook Changes** (business logic):
   - Edit files in `src/lib/` directly
   - Test with both commands to ensure compatibility

3. **Configuration Storage**:
   - All config persists via `LocalStorage.getItem/setItem`
   - Keys: `"open-in-app:apps"`, `"open-in-app:paths"`, `"open-in-app:frecency"`
   - Prefer storing structured data (JSON) with corruption handling

4. **Adding New App Features**:
   - Update `AppConfig` interface in `use-apps.ts`
   - Update `AppForm` in `manage-apps.tsx`
   - Update app icon resolver in `open-in-app.tsx` if icon handling changes

5. **Changing Path Scanning Logic**:
   - Edit `useFolders()` in `use-folders.ts`
   - Glob patterns and exclusions managed there
   - Test glob pattern expansion with `~` tilde expansion

### Testing & Build

- **Build:** `npm run build`
- **Dev:** `npm run dev` (Raycast CLI watch mode)
- **Lint:** `npm run lint` or `npm run fix-lint`
- **Stack:** TypeScript, React (Raycast JSX), @raycast/api

### Dependencies

**Runtime:**
- `@raycast/api` (^1.104.9) — Raycast extension API
- `@raycast/utils` (^1.17.0) — Utility helpers
- `fuzzysort` (^3.1.0) — Fuzzy search ranking
- `glob` (^10.4.5) — Path globbing (*, **, etc.)

**Dev:**
- `typescript` (^5.8.2)
- `@types/react` (19.0.10)
- `@types/node` (22.13.10)
- `@types/glob` (^8.1.0)
- `eslint`, `prettier` — Code quality

### Common Patterns

**LocalStorage with Corruption Handling:**
```tsx
async function load() {
  const raw = await LocalStorage.getItem<string>(STORAGE_KEY);
  try {
    setData(raw ? JSON.parse(raw) : []);
  } catch {
    await LocalStorage.removeItem(STORAGE_KEY);
    setData([]);
  }
}
```

**Frecency with useRef (closure pattern):**
```tsx
const freqRef = useRef<FreqMap>({});
function trackOpen(path: string) {
  const updated = { ...freqRef.current, [path]: (freqRef.current[path] ?? 0) + 1 };
  freqRef.current = updated;
  LocalStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}
```

**Glob Scanning with Exclusions:**
```tsx
const matches = await glob(pattern, { ignore: IGNORE });
// Always excludes: node_modules, .git, dist, __pycache__, etc.
```

### File Structure Guidelines

- Commands at `src/` root (open-in-app.tsx, manage-apps.tsx)
- Hooks at `src/lib/` (use-*.ts pattern for React hooks)
- Utils at `src/lib/` (standalone functions like parse-alias, fuzzy-search)
- Each file <200 lines (split complex logic into separate modules)

---

**Next:** See [`src/lib/AGENTS.md`](./src/lib/AGENTS.md) for utility and hook documentation.
