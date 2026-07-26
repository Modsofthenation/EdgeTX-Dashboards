import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { getGeneratedDirForKey, sanitizeWidgetName } from "./paths.ts";
import { resolveDisplayName } from "./widgetInstance.ts";

export interface ZipEntry {
  /** Absolute path on disk */
  filePath: string;
  /** Path inside the zip archive */
  zipPath: string;
}

/** Map a workspace-relative path under generated/<key>/ to a zip/SD path. */
export function mapWidgetRelPathToZipPath(
  displayName: string,
  relPath: string,
): string {
  const normalized = relPath.replace(/\\/g, "/");

  if (normalized === "main.lua" || normalized === "INSTALL.md") {
    return `WIDGETS/${displayName}/${normalized}`;
  }

  if (normalized.startsWith("tools/") && normalized.endsWith(".lua")) {
    const base = normalized.slice("tools/".length);
    return `SCRIPTS/TOOLS/${base}`;
  }

  if (normalized.startsWith("telemetry/") && normalized.endsWith(".lua")) {
    const base = normalized.slice("telemetry/".length);
    return `SCRIPTS/TELEMETRY/${base}`;
  }

  // Model / asset PNGs for EdgeTX Bitmap.open("/IMAGES/…")
  if (normalized.startsWith("images/") || normalized.startsWith("IMAGES/")) {
    const base = normalized.replace(/^images\//i, "");
    return `IMAGES/${base}`;
  }

  // Widget assets (png, etc.)
  return `WIDGETS/${displayName}/${normalized}`;
}

export function listWidgetPackageEntries(workspaceKey: string): ZipEntry[] {
  const root = getGeneratedDirForKey(workspaceKey);
  if (!existsSync(root)) return [];

  const displayName = resolveDisplayName(workspaceKey);
  if (!displayName) return [];

  const safeDisplay = sanitizeWidgetName(displayName);
  const entries: ZipEntry[] = [];

  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === ".widget-meta.json") continue;
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        walk(full);
        continue;
      }
      const rel = relative(root, full).replace(/\\/g, "/");
      if (rel.startsWith(".")) continue;
      entries.push({
        filePath: full,
        zipPath: mapWidgetRelPathToZipPath(safeDisplay, rel),
      });
    }
  };

  walk(root);
  return entries;
}

export interface CompanionManifest {
  tools: string[];
  telemetry: string[];
  assets: string[];
  /** Filenames under zip IMAGES/ (model bitmaps). */
  images: string[];
}

export function detectCompanions(workspaceKey: string): CompanionManifest {
  const manifest: CompanionManifest = {
    tools: [],
    telemetry: [],
    assets: [],
    images: [],
  };
  const displayName = resolveDisplayName(workspaceKey) ?? workspaceKey;
  for (const entry of listWidgetPackageEntries(workspaceKey)) {
    if (entry.zipPath.startsWith("SCRIPTS/TOOLS/")) {
      manifest.tools.push(entry.zipPath.replace("SCRIPTS/TOOLS/", ""));
    } else if (entry.zipPath.startsWith("SCRIPTS/TELEMETRY/")) {
      manifest.telemetry.push(entry.zipPath.replace("SCRIPTS/TELEMETRY/", ""));
    } else if (entry.zipPath.startsWith("IMAGES/")) {
      manifest.images.push(entry.zipPath.replace("IMAGES/", ""));
    } else if (
      entry.zipPath.startsWith(`WIDGETS/${displayName}/`) &&
      !entry.zipPath.endsWith("main.lua") &&
      !entry.zipPath.endsWith("INSTALL.md")
    ) {
      manifest.assets.push(entry.zipPath.split("/").pop() ?? entry.zipPath);
    }
  }
  return manifest;
}
