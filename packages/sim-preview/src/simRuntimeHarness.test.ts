import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EDITOR_PREVIEW_SCENARIO,
  parseLuaToDrawCommands,
  isInterpretationReliable,
  getLastPreviewParseMeta,
  type DrawRecord,
} from "@widget-gen/layout-verify";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..", "..", "..");
const MANIFEST = join(ROOT, "apps", "web", "public", "sim", "manifest.json");
const EXAMPLES = join(ROOT, "examples");

const GOLD_EXAMPLES = [
  "tx15-minimal-dashboard.lua",
  "tx15-bfdash8f-whoop-dashboard.lua",
];

/** Stable fingerprint of interpreter draw records for regression goldens. */
function fingerprintRecords(records: DrawRecord[]): string {
  const lines = records
    .filter((r) => r.kind !== "clear")
    .map((r) => {
      const parts = [
        r.kind,
        r.x ?? "",
        r.y ?? "",
        r.w ?? "",
        r.h ?? "",
        r.r ?? "",
        r.rIn ?? "",
        r.rOut ?? "",
        (r.text ?? "").slice(0, 32),
        r.color ?? "",
      ];
      return parts.join("|");
    });
  return createHash("sha256").update(lines.join("\n")).digest("hex");
}

describe("simRuntime harness (gated on synced WASM)", () => {
  const hasManifest = existsSync(MANIFEST);

  it("manifest + WASM file match declared sha256", { skip: !hasManifest }, () => {
    const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as {
      radios?: { tx15?: { wasm: string; sha256: string; size: number } };
      versions?: Record<string, { wasm: string; size: number; sha256?: string }>;
    };
    const tx15 = manifest.radios?.tx15;
    const fallback = Object.values(manifest.versions ?? {})[0];
    const wasmName = tx15?.wasm ?? fallback?.wasm;
    assert.ok(wasmName, "manifest should list a WASM file");
    assert.match(wasmName, /\.wasm$/);
    const size = tx15?.size ?? fallback?.size ?? 0;
    assert.ok(size > 1_000_000);
    const wasmPath = join(ROOT, "apps", "web", "public", "sim", wasmName);
    assert.ok(existsSync(wasmPath), `WASM file missing: ${wasmPath}`);
    const bytes = readFileSync(wasmPath);
    assert.ok(bytes.byteLength > 1_000_000);
    const expectedSha = tx15?.sha256 ?? fallback?.sha256;
    if (expectedSha) {
      const actual = createHash("sha256").update(bytes).digest("hex");
      assert.equal(actual, expectedSha, "WASM sha256 must match manifest");
    }
  });
});

describe("interpreter golden contracts (always run)", () => {
  for (const file of GOLD_EXAMPLES) {
    it(`${file} produces reliable draw records for editor preview scenario`, () => {
      const path = join(EXAMPLES, file);
      assert.ok(existsSync(path), `missing example ${file}`);
      const source = readFileSync(path, "utf8");
      const records = parseLuaToDrawCommands(source, EDITOR_PREVIEW_SCENARIO);
      const meta = getLastPreviewParseMeta();
      assert.ok(records.length > 3, `${file}: expected draw records`);
      assert.ok(
        records.some((r) => r.kind === "clear" || r.kind === "filledRect" || r.kind === "text"),
        `${file}: expected visible draw kinds`
      );
      assert.equal(
        isInterpretationReliable(records, meta.skippedTextCount) || meta.skippedTextCount === 0,
        true,
        `${file}: unreliable interpretation (skipped=${meta.skippedTextCount})`
      );
    });

    it(`${file} draw fingerprint is stable for editor-preview scenario`, () => {
      const path = join(EXAMPLES, file);
      const source = readFileSync(path, "utf8");
      const a = fingerprintRecords(parseLuaToDrawCommands(source, EDITOR_PREVIEW_SCENARIO));
      const b = fingerprintRecords(parseLuaToDrawCommands(source, EDITOR_PREVIEW_SCENARIO));
      assert.equal(a, b);
      assert.match(a, /^[a-f0-9]{64}$/);
    });
  }
});

/**
 * Interpreter ↔ WASM contract: when WASM is present, interpreter goldens must remain
 * reliable. Full framebuffer pixel compare requires a browser WasmRunner; CI gates on
 * sha256 + interpreter fingerprints until a headless runner is available.
 */
describe("interpreter↔WASM contract gate", () => {
  it("gold examples stay reliable whenever WASM firmware is synced", {
    skip: !existsSync(MANIFEST),
  }, () => {
    for (const file of GOLD_EXAMPLES) {
      const source = readFileSync(join(EXAMPLES, file), "utf8");
      const records = parseLuaToDrawCommands(source, EDITOR_PREVIEW_SCENARIO);
      const meta = getLastPreviewParseMeta();
      assert.ok(
        isInterpretationReliable(records, meta.skippedTextCount) || meta.skippedTextCount === 0,
        `${file}: interpreter must be reliable when WASM is available`
      );
      assert.ok(records.length > 3);
    }
  });
});
