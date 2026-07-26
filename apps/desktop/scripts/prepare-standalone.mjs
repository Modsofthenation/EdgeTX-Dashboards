#!/usr/bin/env node
/**
 * Build Next.js standalone output and stage it for the Tauri desktop bundle.
 *
 * Layout (after this script):
 *   apps/desktop/resources/standalone/
 *     apps/web/server.js
 *     apps/web/.next/static/...
 *     apps/web/public/...  (includes sim WASM)
 *     node_modules/...
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DESKTOP_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = join(DESKTOP_ROOT, "..", "..");
const WEB_ROOT = join(REPO_ROOT, "apps", "web");
const OUT_ROOT = join(DESKTOP_ROOT, "resources", "standalone");

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    env: { ...process.env, ...env },
    stdio: "inherit",
    // Windows resolves npm.cmd only when shell is enabled.
    shell: process.platform === "win32",
  });
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("→ Ensuring EdgeTX WASM assets…");
run(process.execPath, [join(REPO_ROOT, "scripts", "ensure-edgetx-wasm.mjs")]);

console.log("→ Fetching bundled Node for the sidecar…");
run(process.execPath, [
  join(DESKTOP_ROOT, "scripts", "fetch-bundled-node.mjs"),
]);

console.log("→ Building Next.js standalone (DESKTOP_BUILD=1)…");
run("npm", ["run", "build", "-w", "@widget-gen/web"], {
  DESKTOP_BUILD: "1",
  SKIP_WASM_SYNC: "1",
});

const standaloneDir = join(WEB_ROOT, ".next", "standalone");
const staticDir = join(WEB_ROOT, ".next", "static");
const publicDir = join(WEB_ROOT, "public");

if (!existsSync(join(standaloneDir, "apps", "web", "server.js"))) {
  console.error(
    "Standalone server.js missing. Expected at apps/web/.next/standalone/apps/web/server.js",
  );
  process.exit(1);
}

console.log("→ Staging standalone resources…");
rmSync(OUT_ROOT, { recursive: true, force: true });
mkdirSync(OUT_ROOT, { recursive: true });
cpSync(standaloneDir, OUT_ROOT, { recursive: true });

const webOut = join(OUT_ROOT, "apps", "web");
mkdirSync(join(webOut, ".next"), { recursive: true });
cpSync(staticDir, join(webOut, ".next", "static"), { recursive: true });
cpSync(publicDir, join(webOut, "public"), { recursive: true });

const stagedSim = join(webOut, "public", "sim");
const stagedManifest = join(stagedSim, "manifest.json");
if (!existsSync(stagedManifest)) {
  console.warn(
    `Warning: ${stagedManifest} missing — Preferences → Simulator WASM will need Download after install.`,
  );
} else {
  console.log(`WASM sim assets staged under ${stagedSim}`);
}

writeFileSync(
  join(OUT_ROOT, "SIDECAR.json"),
  JSON.stringify(
    {
      entry: "apps/web/server.js",
      cwd: ".",
      healthPath: "/api/health",
      builtAt: new Date().toISOString(),
    },
    null,
    2,
  ) + "\n",
);

const stagedServer = join(OUT_ROOT, "apps", "web", "server.js");
if (!existsSync(stagedServer)) {
  console.error(`Staging failed — missing ${stagedServer}`);
  process.exit(1);
}

// Guard against the old array-form resource path that lands under
// $RESOURCE/_up_/resources/standalone (breaks release lookups).
const tauriConfPath = join(DESKTOP_ROOT, "src-tauri", "tauri.conf.json");
const tauriConf = JSON.parse(readFileSync(tauriConfPath, "utf8"));
const resources = tauriConf?.bundle?.resources;
const mappedOk =
  resources &&
  !Array.isArray(resources) &&
  typeof resources === "object" &&
  Object.entries(resources).some(
    ([from, to]) =>
      String(from).replace(/\\/g, "/").includes("resources/standalone") &&
      String(to).replace(/\\/g, "/").replace(/\/+$/, "") === "standalone",
  );
const nodeMapped =
  resources &&
  !Array.isArray(resources) &&
  typeof resources === "object" &&
  Object.entries(resources).some(
    ([from, to]) =>
      String(from).replace(/\\/g, "/").includes("resources/node") &&
      String(to).replace(/\\/g, "/").replace(/\/+$/, "") === "node",
  );
if (!mappedOk) {
  console.error(
    "tauri.conf.json bundle.resources must map ../resources/standalone/ → standalone/ so the installer embeds $RESOURCE/standalone/apps/web/server.js",
  );
  process.exit(1);
}
if (!nodeMapped) {
  console.error(
    "tauri.conf.json bundle.resources must map ../resources/node/ → node/ so the installer embeds a portable Node binary",
  );
  process.exit(1);
}

const nodeDir = join(DESKTOP_ROOT, "resources", "node");
const bundledNode =
  ["node", "node.exe"]
    .map((n) => join(nodeDir, n))
    .find((p) => existsSync(p)) ?? null;
if (!bundledNode && process.env.SKIP_BUNDLED_NODE !== "1") {
  console.error(
    `Bundled Node binary missing under ${nodeDir}. fetch-bundled-node.mjs should have staged it.`,
  );
  process.exit(1);
}

console.log(`Standalone staged at ${OUT_ROOT}`);
console.log("Tauri resource map OK → $RESOURCE/standalone/ + $RESOURCE/node/");
if (bundledNode) console.log(`Bundled Node: ${bundledNode}`);
