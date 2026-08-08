#!/usr/bin/env node
/**
 * After `tauri build`, assert the Next sidecar landed at
 * $RESOURCE/standalone/apps/web/server.js (not _up_/resources/standalone).
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DESKTOP_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TARGET_ROOT = join(DESKTOP_ROOT, "src-tauri", "target");

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      // Skip huge incremental caches unrelated to bundle layout.
      if (
        name === ".fingerprint" ||
        name === "incremental" ||
        name === "deps"
      ) {
        continue;
      }
      walk(full, acc);
    } else if (
      name === "server.js" &&
      full.replace(/\\/g, "/").endsWith("apps/web/server.js")
    ) {
      acc.push(full);
    }
  }
  return acc;
}

const servers = walk(TARGET_ROOT);
const preferred = servers.filter((p) => {
  const norm = p.replace(/\\/g, "/");
  return (
    norm.includes("/standalone/apps/web/server.js") && !norm.includes("/_up_/")
  );
});
const legacy = servers.filter((p) =>
  p
    .replace(/\\/g, "/")
    .includes("/_up_/resources/standalone/apps/web/server.js"),
);

if (preferred.length === 0) {
  console.error(
    "Desktop bundle check failed: expected standalone/apps/web/server.js under src-tauri/target (without _up_/).",
  );
  if (legacy.length > 0) {
    console.error(
      "Found legacy _up_/resources/standalone layout instead — fix tauri.conf.json bundle.resources map.",
    );
    for (const p of legacy.slice(0, 5)) console.error(`  ${p}`);
  } else if (servers.length > 0) {
    console.error("Found server.js at unexpected paths:");
    for (const p of servers.slice(0, 10)) console.error(`  ${p}`);
  } else {
    console.error("No apps/web/server.js found under src-tauri/target at all.");
  }
  process.exit(1);
}

console.log("Desktop bundle resource layout OK:");
for (const p of preferred.slice(0, 5)) {
  console.log(`  ${p}`);
}
if (legacy.length > 0) {
  console.warn(
    `Note: also found ${legacy.length} legacy _up_ path(s); preferred standalone/ path is present.`,
  );
}
