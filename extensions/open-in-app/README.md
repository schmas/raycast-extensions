# Open in App

Fuzzy-find folders and open them in your preferred apps with alias shortcuts. Type a short alias prefix to target a specific app, or just search — frecency sorting surfaces your most-used folders first.

## Setup

This extension requires a one-time setup before use:

1. Open the **Manage Apps & Paths** command (or press `⌘⇧M` from the search view)
2. **Add at least one app** — pick an installed application and assign a short alias (e.g. `code` for VS Code, `ij` for IntelliJ)
3. **Add at least one search path** — choose a directory where your projects live (e.g. `~/projects`)

That's it. Open the **Open in App** command and start searching.

## Features

- **Fuzzy search** — find folders instantly across all configured paths
- **Alias targeting** — type `ij react` to open the first React match directly in IntelliJ
- **Frecency sorting** — folders you open most frequently rise to the top when no query is active
- **Glob patterns** — configure search paths like `~/work/*/src` or `~/projects/**` for flexible scanning
- **Multiple apps** — switch between apps from the action panel without leaving Raycast
- **Terminal integration** — open any folder in your preferred terminal app
- **Finder reveal** — quickly show a folder in Finder

## Usage

### Basic Search

Open the **Open in App** command and start typing. Results are fuzzy-matched against folder names across all configured search paths.

### Alias Routing

Prefix your search with an app alias followed by a space:

| Input | What Happens |
|---|---|
| `react` | Search for "react", show all apps in actions |
| `ij react` | Search for "react", open directly in IntelliJ |
| `code my-api` | Search for "my-api", open directly in VS Code |

The alias-matched app becomes the primary action. Other apps remain available in the action panel.

### Frecency

When the search bar is empty, folders are sorted by how often you open them. The more you use a folder, the higher it ranks. Start typing to switch to fuzzy-search ranking.

### Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `↵` | Open in primary app (alias-matched or first configured) |
| `⌘T` | Open in default terminal |
| `⌘F` | Show in Finder |
| `⌘C` | Copy path to clipboard |
| `⌘⇧M` | Manage Apps & Paths |

## Configuration

### Apps

Each app has:
- **Alias** — a short prefix (no spaces) used to target the app from the search bar
- **Application** — any installed macOS application

### Search Paths

Paths tell the extension where to look for folders. You can use:
- Plain directories: `~/projects` (scans immediate children)
- Glob patterns: `~/work/*/src` (matches one level deep), `~/repos/**` (matches any depth)

The following directories are always excluded from results: `node_modules`, `.git`, `.hg`, `.svn`, `dist`, `.cache`, `__pycache__`.

### Preferences

| Preference | Description |
|---|---|
| Default Terminal | Terminal app used when opening a folder via `⌘T` |
