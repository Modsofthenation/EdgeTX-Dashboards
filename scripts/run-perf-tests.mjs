#!/usr/bin/env node
/**
 * Runs *.perf.test.ts suites (excluded from default package test globs).
 *
 *   npm run test:perf
 *   UPDATE_PERF_BASELINES=1 npm run test:perf   # rewrite committed baselines
 *   PERF_STRICT=1 npm run test:perf             # 25% regression allowance
 */
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const npxBin = process.platform === "win32" ? "npx.cmd" : "npx";

function walk(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const name of entries) {
    const path = join(dir, name);
    let st;
    try {
      st = statSync(path);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "dist" || name === ".git")
        continue;
      walk(path, acc);
    } else if (name.endsWith(".perf.test.ts")) {
      acc.push(path);
    }
  }
  return acc;
}

/** True when `file` is inside `dir` (or is `dir`). */
function isUnder(file, dir) {
  const rel = relative(dir, file);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== "..");
}

const files = [
  ...walk(join(root, "packages")),
  ...walk(join(root, "apps", "web", "perf")),
].sort();

if (files.length === 0) {
  console.error("No *.perf.test.ts files found");
  process.exit(1);
}

console.log(`test:perf — ${files.length} file(s)`);
for (const f of files) console.log(`  ${relative(root, f)}`);

const packageFiles = files.filter((f) => isUnder(f, join(root, "packages")));
const webFiles = files.filter((f) => isUnder(f, join(root, "apps", "web")));

let failed = false;

if (packageFiles.length) {
  const r = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--test", ...packageFiles],
    { stdio: "inherit", cwd: root, env: process.env },
  );
  if (r.status !== 0) failed = true;
}

if (webFiles.length) {
  const r = spawnSync(npxBin, ["tsx", "--test", ...webFiles], {
    stdio: "inherit",
    cwd: join(root, "apps", "web"),
    env: process.env,
    shell: process.platform === "win32",
  });
  if (r.status !== 0) failed = true;
}

process.exit(failed ? 1 : 0);
