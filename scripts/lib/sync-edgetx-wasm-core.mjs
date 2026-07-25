#!/usr/bin/env node
/**
 * Shared EdgeTX WASM sync core — used by CLI (`sync-edgetx-wasm.mjs`) and
 * optionally mirrored by the web API. Keep logic here so both stay aligned.
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile, stat, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

export const WASM_BASE =
  process.env.EDGETX_WASM_BASE ??
  "https://ypwfws8ckruh03m1.public.blob.vercel-storage.com/wasm";

export const FIRMWARE_VERSIONS = [
  { id: "2.11.0", label: "2.11", fetchVersion: "2.11" },
  { id: "2.12.0", label: "2.12", fetchVersion: "2.12" },
];

export const LEGACY_WASM = "edgetx-tx15-simulator.wasm";
const DISPLAY = { w: 480, h: 320, depth: 16 };

export function versionedWasmName(id) {
  const short = id.replace(/\.0$/, "").replace(/\./g, "-");
  return `edgetx-tx15-${short}-simulator.wasm`;
}

async function fetchBytes(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function getSimDir(repoRoot) {
  return join(repoRoot, "apps", "web", "public", "sim");
}

export async function readSimFirmwareStatus(repoRoot) {
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

  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    return {
      ready: false,
      reason: "invalid-manifest",
      outDir,
      manifest: null,
      files: [],
    };
  }

  const names = new Set([LEGACY_WASM]);
  for (const entry of Object.values(manifest.versions ?? {})) {
    if (entry?.wasm) names.add(entry.wasm);
  }
  if (manifest.radios?.tx15?.wasm) names.add(manifest.radios.tx15.wasm);

  const files = [];
  let ready = true;
  for (const name of names) {
    const path = join(outDir, name);
    const present = existsSync(path);
    let size = 0;
    if (present) {
      size = (await stat(path)).size;
    }
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
    source: manifest.source ?? WASM_BASE,
    defaultVersion: manifest.defaultVersion ?? null,
    syncedAt: manifest.syncedAt ?? null,
  };
}

export async function syncSimFirmware(repoRoot, { onProgress } = {}) {
  const outDir = getSimDir(repoRoot);
  await mkdir(outDir, { recursive: true });

  const manifest = {
    defaultVersion: "2.11.0",
    source: WASM_BASE,
    syncedAt: new Date().toISOString(),
    versions: {},
    radios: {
      tx15: {
        name: "RadioMaster TX15",
        wasm: LEGACY_WASM,
        display: DISPLAY,
      },
    },
  };

  const downloaded = new Map();
  const total = FIRMWARE_VERSIONS.length;
  let step = 0;

  for (const version of FIRMWARE_VERSIONS) {
    step += 1;
    const wasmFile = versionedWasmName(version.id);
    const url = `${WASM_BASE}/${LEGACY_WASM}`;
    const outPath = join(outDir, wasmFile);
    onProgress?.({
      phase: "download",
      step,
      total,
      version: version.id,
      label: version.label,
      file: wasmFile,
      message: `Downloading ${version.label}…`,
    });

    const bytes = await fetchBytes(url);
    const hash = sha256Hex(bytes);
    const existing = await readFile(outPath).catch(() => null);
    if (!(existing && sha256Hex(existing) === hash)) {
      await writeFile(outPath, bytes);
    }

    const { size } = await stat(outPath);
    downloaded.set(version.id, {
      wasmFile,
      hash,
      size,
      label: version.label,
    });
  }

  const hashToId = new Map();
  for (const [id, meta] of downloaded) {
    if (!hashToId.has(meta.hash)) hashToId.set(meta.hash, id);
  }

  for (const [id, meta] of downloaded) {
    const aliasOf =
      hashToId.get(meta.hash) !== id ? hashToId.get(meta.hash) : undefined;
    manifest.versions[id] = {
      label: meta.label,
      wasm: meta.wasmFile,
      sha256: meta.hash,
      size: meta.size,
      display: DISPLAY,
      ...(aliasOf ? { aliasOf } : {}),
    };
  }

  const defaultMeta = downloaded.get(manifest.defaultVersion);
  if (defaultMeta) {
    const legacyPath = join(outDir, LEGACY_WASM);
    await copyFile(join(outDir, defaultMeta.wasmFile), legacyPath);
    manifest.radios.tx15.sha256 = defaultMeta.hash;
    manifest.radios.tx15.size = defaultMeta.size;
  }

  await writeFile(
    join(outDir, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );

  onProgress?.({
    phase: "done",
    step: total,
    total,
    message: "Simulator firmware ready",
  });

  return readSimFirmwareStatus(repoRoot);
}
