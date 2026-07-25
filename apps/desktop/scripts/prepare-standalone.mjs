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
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
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

console.log(`Standalone staged at ${OUT_ROOT}`);
