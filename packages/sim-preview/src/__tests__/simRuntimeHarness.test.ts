import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..", "..", "..", "..");
const MANIFEST = join(ROOT, "apps", "web", "public", "sim", "manifest.json");

describe("simRuntime harness (gated on synced WASM)", () => {
  it("manifest exists after sync-wasm", { skip: !existsSync(MANIFEST) }, () => {
    const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as {
      radios: { tx15: { wasm: string; sha256: string; size: number } };
    };
    assert.ok(manifest.radios.tx15);
    assert.match(manifest.radios.tx15.wasm, /edgetx-tx15-simulator\.wasm/);
    assert.ok(manifest.radios.tx15.size > 1_000_000);
    const wasmPath = join(ROOT, "apps", "web", "public", "sim", manifest.radios.tx15.wasm);
    assert.ok(existsSync(wasmPath));
  });
});
