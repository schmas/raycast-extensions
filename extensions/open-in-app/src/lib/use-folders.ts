import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { useEffect, useState } from "react";
import { glob } from "glob";
import { PathItem } from "./use-paths";

export interface FolderItem {
  name: string;
  path: string;
  displayPath: string;
  isDirectory: boolean;
}

interface FolderHook {
  folders: FolderItem[];
  isLoading: boolean;
}

const GLOB_CHARS = /[*?[\]{}]/;

const IGNORE = [
  "**/node_modules/**",
  "**/.git/**",
  "**/.hg/**",
  "**/.svn/**",
  "**/dist/**",
  "**/.cache/**",
  "**/__pycache__/**",
];

function expandTilde(p: string): string {
  return p.replace(/^~/, os.homedir());
}

function shortenPath(p: string): string {
  const home = os.homedir();
  return p.startsWith(home) ? "~" + p.slice(home.length) : p;
}

export function useFolders(searchPaths: Pick<PathItem, "path" | "maxDepth">[], includeFiles = false): FolderHook {
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const pathsKey = `${searchPaths.map((p) => `${p.path}:${p.maxDepth ?? ""}`).join("|")}:${includeFiles}`;

  useEffect(() => {
    if (searchPaths.length === 0) {
      setFolders([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    async function scan() {
      const allFolders: FolderItem[] = [];

      for (const item of searchPaths) {
        const expanded = expandTilde(item.path);
        const hasGlob = GLOB_CHARS.test(expanded);

        let cwd: string;
        let pattern: string;
        let maxDepth: number | undefined;

        if (hasGlob) {
          const parts = expanded.split("/");
          const firstGlobIdx = parts.findIndex((part) => GLOB_CHARS.test(part));
          cwd = parts.slice(0, firstGlobIdx).join("/") || "/";
          pattern = parts.slice(firstGlobIdx).join("/");
          maxDepth = item.maxDepth;
        } else {
          cwd = expanded;
          pattern = "*";
          maxDepth = item.maxDepth ?? 1;
        }

        try {
          if (!(await fs.promises.stat(cwd)).isDirectory()) continue;
        } catch {
          continue;
        }

        if (!hasGlob) {
          allFolders.push({ name: path.basename(cwd), path: cwd, displayPath: shortenPath(cwd), isDirectory: true });
        }

        try {
          const matches = await glob(pattern, { cwd, absolute: true, maxDepth, ignore: IGNORE });

          await Promise.all(
            matches.map(async (match) => {
              try {
                const stat = await fs.promises.stat(match);
                if (stat.isDirectory() || includeFiles) {
                  allFolders.push({
                    name: path.basename(match),
                    path: match,
                    displayPath: shortenPath(match),
                    isDirectory: stat.isDirectory(),
                  });
                }
              } catch {
                // skip inaccessible paths
              }
            }),
          );
        } catch {
          // skip invalid patterns
        }
      }

      if (cancelled) return;

      const seen = new Set<string>();
      const unique = allFolders.filter((f) => {
        if (seen.has(f.path)) return false;
        seen.add(f.path);
        return true;
      });
      setFolders(unique);
      setIsLoading(false);
    }

    scan();
    return () => {
      cancelled = true;
    };
  }, [pathsKey]);

  return { folders, isLoading };
}
