import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
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
const WASM_BASE =
  process.env.EDGETX_WASM_BASE ??
  "https://ypwfws8ckruh03m1.public.blob.vercel-storage.com/wasm";
const FIRMWARE_VERSIONS = [
  { id: "2.11.0", label: "2.11" },
  { id: "2.12.0", label: "2.12" },
] as const;
const DISPLAY = { w: 480, h: 320, depth: 16 };

function versionedWasmName(id: string): string {
  const short = id.replace(/\.0$/, "").replace(/\./g, "-");
  return `edgetx-tx15-${short}-simulator.wasm`;
}

function looksLikeSimDir(dir: string): boolean {
  return existsSync(join(dir, "manifest.json")) || existsSync(dir);
}

/**
 * Resolve the on-disk `public/sim` directory for both monorepo and desktop
 * standalone layouts (where `knowledge/` is not packaged).
 */
export function resolveSimDir(): string {
  if (process.env.WIDGET_GEN_SIM_DIR) {
    return resolve(process.env.WIDGET_GEN_SIM_DIR);
  }

  const starts = [
    process.cwd(),
    resolve(dirname(fileURLToPath(import.meta.url)), "../../.."),
    resolve(dirname(fileURLToPath(import.meta.url)), "../../../.."),
  ];

  const candidates: string[] = [];
  for (const start of starts) {
    let dir = resolve(start);
    for (let depth = 0; depth < 8; depth++) {
      candidates.push(join(dir, "public", "sim"));
      candidates.push(join(dir, "apps", "web", "public", "sim"));
      if (existsSync(join(dir, REPO_MARKER))) {
        candidates.push(join(dir, "apps", "web", "public", "sim"));
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }

  // Prefer a dir that already has a manifest (installed firmware).
  for (const candidate of candidates) {
    if (existsSync(join(candidate, "manifest.json"))) return candidate;
  }

  // Next: any existing sim directory (empty / incomplete is ok for status).
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  // Last resort: standalone-friendly path next to cwd (writable for download).
  const cwd = resolve(process.cwd());
  if (existsSync(join(cwd, "server.js")) || existsSync(join(cwd, "public"))) {
    return join(cwd, "public", "sim");
  }
  if (existsSync(join(cwd, "apps", "web", "server.js"))) {
    return join(cwd, "apps", "web", "public", "sim");
  }

  // Monorepo fallback when knowledge marker exists.
  for (const start of starts) {
    let dir = resolve(start);
    for (let depth = 0; depth < 8; depth++) {
      if (existsSync(join(dir, REPO_MARKER))) {
        return join(dir, "apps", "web", "public", "sim");
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }

  throw new Error(
    `Could not locate simulator firmware directory (public/sim). cwd=${process.cwd()}`,
  );
}

/** @deprecated Prefer resolveSimDir — kept for callers that still think in repo roots. */
export function findRepoRoot(): string | null {
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
  return null;
}

function statusFromDir(outDir: string): SimFirmwareStatus {
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

export function getSimFirmwareStatus(): SimFirmwareStatus {
  return statusFromDir(resolveSimDir());
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Download EdgeTX WASM into the resolved sim directory.
 * Works in desktop standalone (no monorepo `scripts/` required).
 */
export async function downloadSimFirmware(): Promise<SimFirmwareStatus> {
  const outDir = resolveSimDir();
  mkdirSync(outDir, { recursive: true });

  const manifest: Record<string, unknown> = {
    defaultVersion: "2.11.0",
    source: WASM_BASE,
    syncedAt: new Date().toISOString(),
    versions: {} as Record<string, unknown>,
    radios: {
      tx15: {
        name: "RadioMaster TX15",
        wasm: LEGACY_WASM,
        display: DISPLAY,
      },
    },
  };

  const downloaded = new Map<
    string,
    { wasmFile: string; hash: string; size: number; label: string }
  >();

  for (const version of FIRMWARE_VERSIONS) {
    const wasmFile = versionedWasmName(version.id);
    const url = `${WASM_BASE}/${LEGACY_WASM}`;
    const outPath = join(outDir, wasmFile);
    const bytes = await fetchBytes(url);
    const hash = sha256Hex(bytes);
    const existing = existsSync(outPath) ? readFileSync(outPath) : null;
    if (!(existing && sha256Hex(existing) === hash)) {
      writeFileSync(outPath, bytes);
    }
    const { size } = statSync(outPath);
    downloaded.set(version.id, {
      wasmFile,
      hash,
      size,
      label: version.label,
    });
  }

  const hashToId = new Map<string, string>();
  for (const [id, meta] of downloaded) {
    if (!hashToId.has(meta.hash)) hashToId.set(meta.hash, id);
  }

  const versionsOut: Record<string, unknown> = {};
  for (const [id, meta] of downloaded) {
    const aliasOf =
      hashToId.get(meta.hash) !== id ? hashToId.get(meta.hash) : undefined;
    versionsOut[id] = {
      label: meta.label,
      wasm: meta.wasmFile,
      sha256: meta.hash,
      size: meta.size,
      display: DISPLAY,
      ...(aliasOf ? { aliasOf } : {}),
    };
  }
  manifest.versions = versionsOut;

  const defaultMeta = downloaded.get("2.11.0");
  if (defaultMeta) {
    copyFileSync(join(outDir, defaultMeta.wasmFile), join(outDir, LEGACY_WASM));
    const radios = manifest.radios as {
      tx15: Record<string, unknown>;
    };
    radios.tx15.sha256 = defaultMeta.hash;
    radios.tx15.size = defaultMeta.size;
  }

  writeFileSync(
    join(outDir, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );

  return statusFromDir(outDir);
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/** Test helper — expose path heuristics without IO beyond existsSync. */
export function __testLooksLikeSimDir(dir: string): boolean {
  return looksLikeSimDir(dir);
}
