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

  it("maps bundled Node into $RESOURCE/node", () => {
    const conf = JSON.parse(
      readFileSync(join(root, "src-tauri", "tauri.conf.json"), "utf8"),
    );
    const resources = conf.bundle.resources;
    const entry = Object.entries(resources).find(([from]) =>
      String(from).replace(/\\/g, "/").includes("resources/node"),
    );
    assert.ok(entry, "missing node resource mapping");
    assert.equal(
      String(entry[1]).replace(/\\/g, "/").replace(/\/+$/, ""),
      "node",
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

  it("stages knowledge and other generator repo assets into standalone", () => {
    const prepare = readFileSync(
      join(root, "scripts", "prepare-standalone.mjs"),
      "utf8",
    );
    assert.match(prepare, /REPO_ASSET_DIRS/);
    assert.match(prepare, /knowledge/);
    assert.match(prepare, /templates/);
    assert.match(prepare, /tx15\.json/);
  });

  it("sets WIDGET_GEN_REPO_ROOT for the production sidecar", () => {
    const rust = readFileSync(join(root, "src-tauri", "src", "lib.rs"), "utf8");
    assert.match(rust, /WIDGET_GEN_REPO_ROOT/);
    assert.match(rust, /ensure_writable_workspace/);
    assert.match(rust, /knowledge/);
  });

  it("allows dialog save for localhost/127.0.0.1 remote webviews", () => {
    const caps = JSON.parse(
      readFileSync(join(root, "src-tauri", "capabilities", "default.json"), "utf8"),
    );
    assert.ok(Array.isArray(caps.remote?.urls));
    assert.ok(
      caps.remote.urls.some((u) => String(u).includes("localhost")),
      "missing localhost remote URL",
    );
    assert.ok(
      caps.remote.urls.some((u) => String(u).includes("127.0.0.1")),
      "missing 127.0.0.1 remote URL",
    );
    assert.ok(
      caps.permissions.includes("dialog:allow-save"),
      "missing dialog:allow-save (Download / Save project)",
    );
    assert.ok(
      caps.permissions.includes("dialog:allow-open"),
      "missing dialog:allow-open (Pick SD / Open project)",
    );
  });
});
