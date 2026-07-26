#!/usr/bin/env node
/**
 * Format only git-changed files that Prettier owns.
 * Use before commit so `npm run fmt:check` does not fail in CI.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const PRETTIER_EXT = /\.(ts|tsx|mjs|json|md|css)$/;

function git(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || "").trim();
    throw new Error(err || `git ${args.join(" ")} failed`);
  }
  return (result.stdout || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function changedFiles() {
  const tracked = new Set([
    ...git(["diff", "--name-only", "--diff-filter=ACMR"]),
    ...git(["diff", "--name-only", "--cached", "--diff-filter=ACMR"]),
  ]);
  // Include untracked files that match the Prettier glob (new docs/scripts).
  for (const path of git(["ls-files", "--others", "--exclude-standard"])) {
    tracked.add(path);
  }
  return [...tracked].filter(
    (path) => PRETTIER_EXT.test(path) && existsSync(path),
  );
}

const files = changedFiles();
if (files.length === 0) {
  console.log("fmt:changed — no Prettier-owned changes");
  process.exit(0);
}

console.log(`fmt:changed — formatting ${files.length} file(s)`);
const result = spawnSync("npx", ["prettier", "--write", ...files], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
