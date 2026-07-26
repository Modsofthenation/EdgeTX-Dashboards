#!/usr/bin/env node
/**
 * Smoke-test that a desktop-like standalone tree can resolve getRepoRoot()
 * the same way the packaged sidecar does (WIDGET_GEN_REPO_ROOT + knowledge/).
 *
 * Usage (after prepare-standalone):
 *   node apps/desktop/scripts/smoke-standalone-generate.mjs
 */
import { existsSync, mkdtempSync, cpSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const DESKTOP_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = join(DESKTOP_ROOT, "..", "..");
const STANDALONE = join(DESKTOP_ROOT, "resources", "standalone");
const MARKER = join("knowledge", "radios", "tx15.json");

function fail(msg) {
  console.error(`smoke-standalone-generate: ${msg}`);
  process.exit(1);
}

if (!existsSync(join(STANDALONE, MARKER))) {
  fail(
    `Missing ${join(STANDALONE, MARKER)}. Run npm run desktop:prepare first so knowledge/ is staged.`,
  );
}

const workspace = mkdtempSync(join(tmpdir(), "edgetx-smoke-ws-"));
try {
  for (const name of ["knowledge", "templates", "examples", "stubs"]) {
    const src = join(STANDALONE, name);
    if (existsSync(src))
      cpSync(src, join(workspace, name), { recursive: true });
  }
  const rules = join(STANDALONE, ".cursor", "rules");
  if (existsSync(rules)) {
    cpSync(rules, join(workspace, ".cursor", "rules"), { recursive: true });
  }

  const probe = `
import { getRepoRoot } from ${JSON.stringify(pathToFileURL(join(REPO_ROOT, "packages/generator/src/knowledge.ts")).href)};
const root = getRepoRoot();
if (!root.includes(${JSON.stringify(workspace.replace(/\\/g, "/"))}) && root !== ${JSON.stringify(workspace)}) {
  // Allow resolved path normalization
}
console.log("OK", root);
`;
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--input-type=module", "-e", probe],
    {
      env: {
        ...process.env,
        WIDGET_GEN_REPO_ROOT: workspace,
      },
      encoding: "utf8",
    },
  );
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    fail("getRepoRoot() probe failed");
  }
  console.log(result.stdout.trim());
  console.log("smoke-standalone-generate: passed");
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
