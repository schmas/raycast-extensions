# Project Overview & Product Requirements

**Project:** Open in App — Raycast Extension
**Author:** schmas | **License:** MIT | **Platform:** macOS only
**Version:** 1.0.0 | **Status:** Stable

## Purpose

A Raycast command that lets developers quickly fuzzy-find folders across configured search paths and open them in their preferred applications via short aliases. Surfaces frequently-used folders first via frecency-based sorting. Reduces friction in multi-app workflows.

## Target Users

- macOS developers juggling multiple projects across IDEs, editors, and tools
- Engineers who organize code in multiple project directories
- Teams using standardized folder structures with globbing patterns (e.g., `~/work/*/src`)

## Core Value Propositions

1. **Fast access without context switching** — Find and open folders faster than Finder + drag-drop
2. **App-targeted search via aliases** — Type `ij react` to open directly in IntelliJ, not generic
3. **Frecency awareness** — Most-used folders rise naturally; no manual pinning needed
4. **Flexible path scanning** — Glob patterns support complex folder hierarchies
5. **Stateless configuration** — All settings stored in Raycast LocalStorage; zero external files

## Functional Requirements

### Core Features

| Feature              | Requirement                                                            | Status      |
| -------------------- | ---------------------------------------------------------------------- | ----------- |
| Fuzzy search         | Find folders by name across all configured paths                       | ✅ Complete |
| Alias routing        | Prefix search with app alias to target specific app (e.g., `ij react`) | ✅ Complete |
| Frecency sorting     | Sort by open frequency when no search query active                     | ✅ Complete |
| Glob patterns        | Support `*` (one level), `**` (any depth), and depth limits            | ✅ Complete |
| Multi-app actions    | Switch between apps without leaving Raycast                            | ✅ Complete |
| Terminal integration | Open any folder in configured terminal app via `⌘T`                    | ✅ Complete |
| Finder reveal        | Show folder in Finder via `⌘F`                                         | ✅ Complete |
| Path copying         | Copy full path to clipboard via `⌘C`                                   | ✅ Complete |
| File toggle          | Include/exclude files in results via `⌘.`                              | ✅ Complete |
| Frequency display    | Show open count as accessory on list items                             | ✅ Complete |

### Management Command

- **Add/edit/delete apps** — Full CRUD with alias validation
- **Add/edit/delete paths** — Single or bulk edit with depth limits
- **Reorder apps/paths** — Control priority via arrow keys
- **Standalone mode** — Can launch independently or from main command

### Preferences

- **Default Terminal** — App picker for `⌘T` shortcut

## Non-Functional Requirements

| Requirement         | Target                                     | Status                                        |
| ------------------- | ------------------------------------------ | --------------------------------------------- |
| Search speed        | <500ms for 1000 folders                    | ✅ Achieved (parallel glob + in-memory fuzzy) |
| Memory footprint    | <10MB for typical setup                    | ✅ Achieved                                   |
| Data persistence    | No external files, all in LocalStorage     | ✅ Complete                                   |
| Corruption recovery | Auto-reset corrupted storage entries       | ✅ Implemented                                |
| File accessibility  | Graceful skip of inaccessible paths        | ✅ Implemented                                |
| Pattern safety      | Skip patterns resolving to filesystem root | ✅ Implemented                                |

## Architecture Decisions

### Data Storage

- **Why LocalStorage?** Raycast sandboxing + simple JSON serialization. No need for file I/O or complex migrations.
- **Corruption handling:** JSON.parse + try/catch with auto-reset to empty state if corrupted

### Search Pipeline

1. User types → `parseAlias()` extracts alias prefix if present
2. `useFolders()` scans all configured paths in parallel with `glob` lib
3. `fuzzySearch()` ranks results by match quality + frecency tiebreaker
4. If no query → sort by `useFrecency()` open count only
5. `useLastApp()` prefers last 2 apps opened in each folder for quick re-access

### Folder Scanning

- **Parallel promises** — Scan all paths concurrently, aggregate results
- **Glob patterns** — Split pattern at first glob char to determine cwd
- **Depth control** — Limit recursion depth via `maxDepth` on PathItem
- **IGNORE list** — Always exclude node_modules, .git, .hg, .svn, dist, .cache, **pycache**
- **Root safety** — Skip patterns whose cwd resolves to `/` (would scan entire disk)

### App Resolution

- **Icon loading** — Lazy-load installed apps from `getApplications()` on mount
- **Bundle ID fallback** — Use stored `appPath` for icons, fall back to bundle ID lookup
- **Action ordering** — Primary (last-used), secondary (2nd last), then remaining apps

## Acceptance Criteria

- [x] All commands launch without errors
- [x] Search returns correct folders for various glob patterns
- [x] Alias routing targets correct app (alias not found → no action)
- [x] Frecency sorts correctly when query is empty
- [x] Frequent folders show open count in accessories
- [x] Last app remembered per folder for quick re-open
- [x] Storage corruption recovers gracefully
- [x] Terminal shortcut opens in configured terminal
- [x] Files toggle includes/excludes file results
- [x] All keyboard shortcuts work as documented

## Known Limitations

1. **macOS only** — Raycast runs on macOS; no Windows/Linux support
2. **Disk I/O** — Glob scanning can be slow on large hierarchies; mitigation: use maxDepth
3. **Symlinks** — Followed by glob lib; may cause duplicates if multiple symlinks point to same folder
4. **Case-insensitive on APFS** — Fuzzy search respects filesystem case sensitivity
5. **Storage size** — LocalStorage has limits per extension (usually ~500KB); frecency auto-prunes at 500 entries

## Success Metrics

- **User adoption:** Public availability in Raycast Store
- **Performance:** <500ms search latency for 1000 folders
- **Reliability:** Zero crashes in production; automatic error recovery
- **Frequency distribution:** Frecency accurately reflects usage patterns

## Future Considerations

- **Frecency decay:** Weight recent opens more heavily (time-based decay)
- **Workspace support:** Remember last opened app per workspace/window
- **Search history:** Quick access to recently searched folders
- **Import/export:** Backup/restore app and path configurations
- **Performance analytics:** Monitor search latency, glob scan duration
- **Custom ignore patterns:** User-configurable IGNORE list per path
