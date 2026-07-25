import { existsSync, readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type SimFirmwareFileStatus = {
  name: string;
  present: boolean;
  size: number;
  ok: boolean;
};

export type SimFirmwareStatus = {
  ready: boolean;
  reason: string;
  outDir: string;
  manifest: Record<string, unknown> | null;
  files: SimFirmwareFileStatus[];
  source?: string;
  defaultVersion?: string | null;
  syncedAt?: string | null;
};

const LEGACY_WASM = "edgetx-tx15-simulator.wasm";
const REPO_MARKER = join("knowledge", "radios", "tx15.json");

function findRepoRoot(): string {
  if (process.env.WIDGET_GEN_REPO_ROOT) {
    const envRoot = resolve(process.env.WIDGET_GEN_REPO_ROOT);
    if (existsSync(join(envRoot, REPO_MARKER))) return envRoot;
  }

  const starts = [
    process.cwd(),
    resolve(dirname(fileURLToPath(import.meta.url)), "../../.."),
    resolve(dirname(fileURLToPath(import.meta.url)), "../../../.."),
  ];

  for (const start of starts) {
    let dir = resolve(start);
    for (let depth = 0; depth < 8; depth++) {
      if (existsSync(join(dir, REPO_MARKER))) return dir;
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }

  throw new Error(
    `Could not locate repository root (missing ${REPO_MARKER}). cwd=${process.cwd()}`,
  );
}

function getSimDir(repoRoot: string): string {
  return join(repoRoot, "apps", "web", "public", "sim");
}

export function getSimFirmwareStatus(): SimFirmwareStatus {
  const repoRoot = findRepoRoot();
  const outDir = getSimDir(repoRoot);
  const manifestPath = join(outDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    return {
      ready: false,
      reason: "missing-manifest",
      outDir,
      manifest: null,
      files: [],
    };
  }

  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return {
      ready: false,
      reason: "invalid-manifest",
      outDir,
      manifest: null,
      files: [],
    };
  }

  const names = new Set<string>([LEGACY_WASM]);
  const versions = manifest.versions as
    Record<string, { wasm?: string }> | undefined;
  if (versions) {
    for (const entry of Object.values(versions)) {
      if (entry?.wasm) names.add(entry.wasm);
    }
  }
  const radios = manifest.radios as { tx15?: { wasm?: string } } | undefined;
  if (radios?.tx15?.wasm) names.add(radios.tx15.wasm);

  const files: SimFirmwareFileStatus[] = [];
  let ready = true;
  for (const name of names) {
    const path = join(outDir, name);
    const present = existsSync(path);
    const size = present ? statSync(path).size : 0;
    const ok = present && size >= 1024;
    if (!ok) ready = false;
    files.push({ name, present, size, ok });
  }

  return {
    ready,
    reason: ready ? "ok" : "incomplete",
    outDir,
    manifest,
    files,
    source: typeof manifest.source === "string" ? manifest.source : undefined,
    defaultVersion:
      typeof manifest.defaultVersion === "string"
        ? manifest.defaultVersion
        : null,
    syncedAt: typeof manifest.syncedAt === "string" ? manifest.syncedAt : null,
  };
}

export function downloadSimFirmware(): SimFirmwareStatus {
  const repoRoot = findRepoRoot();
  const script = join(repoRoot, "scripts", "sync-edgetx-wasm.mjs");
  const result = spawnSync(process.execPath, [script], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    const detail =
      result.stderr?.toString().trim() ||
      result.stdout?.toString().trim() ||
      `sync exited ${result.status}`;
    throw new Error(detail);
  }
  return getSimFirmwareStatus();
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
