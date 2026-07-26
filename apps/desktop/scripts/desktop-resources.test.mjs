import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("desktop Tauri standalone resources", () => {
  it("maps staged standalone/ into $RESOURCE/standalone (not _up_)", () => {
    const conf = JSON.parse(
      readFileSync(join(root, "src-tauri", "tauri.conf.json"), "utf8"),
    );
    const resources = conf.bundle.resources;
    assert.equal(Array.isArray(resources), false, "must use resources map");
    assert.equal(typeof resources, "object");
    const entry = Object.entries(resources).find(([from]) =>
      String(from).replace(/\\/g, "/").includes("resources/standalone"),
    );
    assert.ok(entry, "missing standalone resource mapping");
    const [, to] = entry;
    assert.equal(
      String(to).replace(/\\/g, "/").replace(/\/+$/, ""),
      "standalone",
    );
  });

  it("documents the sidecar entry in SIDECAR staging contract", () => {
    const prepare = readFileSync(
      join(root, "scripts", "prepare-standalone.mjs"),
      "utf8",
    );
    assert.match(prepare, /apps\/web\/server\.js/);
    assert.match(prepare, /standalone/);
  });
});
