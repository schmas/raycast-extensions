import { open } from "@raycast/api";
import type { AppConfig } from "./use-apps";

/**
 * Opens path in specified app using Raycast's open() API.
 * Uses bundle ID for precise app targeting.
 */
export async function openInApp(filePath: string, app: AppConfig): Promise<void> {
  await open(filePath, app.bundleId);
}
