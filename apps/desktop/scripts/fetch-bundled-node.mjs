#!/usr/bin/env node
/**
 * Download a portable Node.js 22 binary into apps/desktop/resources/node/
 * so release installers can spawn the Next sidecar without a system Node.
 *
 * Override version with EDGETX_BUNDLED_NODE_VERSION (default 22.14.0).
 * Skip with SKIP_BUNDLED_NODE=1 (CI debug only).
 */
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  rmSync,
  chmodSync,
  writeFileSync,
  renameSync,
} from "node:fs";
import { pipeline } from "node:stream/promises";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";

const DESKTOP_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_ROOT = join(DESKTOP_ROOT, "resources", "node");
const VERSION = process.env.EDGETX_BUNDLED_NODE_VERSION || "22.14.0";

function detectTarget() {
  const fromEnv = process.env.EDGETX_NODE_TARGET?.trim();
  if (fromEnv) return fromEnv;

  const platform = process.env.TAURI_ENV_PLATFORM || process.platform;
  const arch = process.env.TAURI_ENV_ARCH || process.arch;

  if (platform === "windows" || platform === "win32") {
    return arch === "arm64" ? "win-arm64" : "win-x64";
  }
  if (platform === "darwin" || platform === "macos") {
    return arch === "x64" || arch === "x86_64" ? "darwin-x64" : "darwin-arm64";
  }
  // linux
  return arch === "arm64" || arch === "aarch64" ? "linux-arm64" : "linux-x64";
}

function distSpec(target) {
  const base = `https://nodejs.org/dist/v${VERSION}`;
  switch (target) {
    case "win-x64":
      return {
        url: `${base}/node-v${VERSION}-win-x64.zip`,
        kind: "zip",
        binaryRel: `node-v${VERSION}-win-x64/node.exe`,
        outName: "node.exe",
      };
    case "win-arm64":
      return {
        url: `${base}/node-v${VERSION}-win-arm64.zip`,
        kind: "zip",
        binaryRel: `node-v${VERSION}-win-arm64/node.exe`,
        outName: "node.exe",
      };
    case "darwin-arm64":
      return {
        url: `${base}/node-v${VERSION}-darwin-arm64.tar.gz`,
        kind: "targz",
        binaryRel: `node-v${VERSION}-darwin-arm64/bin/node`,
        outName: "node",
      };
    case "darwin-x64":
      return {
        url: `${base}/node-v${VERSION}-darwin-x64.tar.gz`,
        kind: "targz",
        binaryRel: `node-v${VERSION}-darwin-x64/bin/node`,
        outName: "node",
      };
    case "linux-arm64":
      return {
        url: `${base}/node-v${VERSION}-linux-arm64.tar.gz`,
        kind: "targz",
        binaryRel: `node-v${VERSION}-linux-arm64/bin/node`,
        outName: "node",
      };
    case "linux-x64":
    default:
      return {
        url: `${base}/node-v${VERSION}-linux-x64.tar.gz`,
        kind: "targz",
        binaryRel: `node-v${VERSION}-linux-x64/bin/node`,
        outName: "node",
      };
  }
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Download failed ${res.status} ${url}`);
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

function extractZip(archive, destDir) {
  // Prefer system unzip / PowerShell Expand-Archive.
  if (process.platform === "win32") {
    const ps = spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `Expand-Archive -LiteralPath '${archive.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`,
      ],
      { stdio: "inherit" },
    );
    if (ps.status !== 0) throw new Error("Expand-Archive failed");
    return;
  }
  const unzip = spawnSync("unzip", ["-qo", archive, "-d", destDir], {
    stdio: "inherit",
  });
  if (unzip.status !== 0) throw new Error("unzip failed — install unzip");
}

function extractTarGz(archive, destDir) {
  const tar = spawnSync("tar", ["-xzf", archive, "-C", destDir], {
    stdio: "inherit",
  });
  if (tar.status !== 0) throw new Error("tar extract failed");
}

async function main() {
  if (process.env.SKIP_BUNDLED_NODE === "1") {
    console.log("SKIP_BUNDLED_NODE=1 — leaving resources/node untouched");
    return;
  }

  const target = detectTarget();
  const spec = distSpec(target);
  console.log(`→ Fetching Node ${VERSION} (${target})…`);

  const tmpRoot = join(DESKTOP_ROOT, "resources", ".node-tmp");
  rmSync(OUT_ROOT, { recursive: true, force: true });
  rmSync(tmpRoot, { recursive: true, force: true });
  mkdirSync(tmpRoot, { recursive: true });
  mkdirSync(OUT_ROOT, { recursive: true });

  const archiveName = spec.url.split("/").pop();
  const archivePath = join(tmpRoot, archiveName);
  await download(spec.url, archivePath);

  const extractDir = join(tmpRoot, "extract");
  mkdirSync(extractDir, { recursive: true });
  if (spec.kind === "zip") extractZip(archivePath, extractDir);
  else extractTarGz(archivePath, extractDir);

  const extractedBin = join(extractDir, spec.binaryRel);
  if (!existsSync(extractedBin)) {
    throw new Error(`Extracted binary missing: ${extractedBin}`);
  }

  const outBin = join(OUT_ROOT, spec.outName);
  // Copy via rename when same FS; fall back to spawn cp.
  try {
    renameSync(extractedBin, outBin);
  } catch {
    const cp = spawnSync("cp", [extractedBin, outBin], { stdio: "inherit" });
    if (cp.status !== 0) throw new Error("Failed to copy node binary");
  }
  if (process.platform !== "win32") {
    chmodSync(outBin, 0o755);
  }

  writeFileSync(
    join(OUT_ROOT, "NODE.json"),
    JSON.stringify(
      {
        version: VERSION,
        target,
        binary: spec.outName,
        fetchedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
  );

  rmSync(tmpRoot, { recursive: true, force: true });
  console.log(`Bundled Node staged at ${outBin}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
