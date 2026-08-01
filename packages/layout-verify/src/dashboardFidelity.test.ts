import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EDITOR_PREVIEW_SCENARIO,
  parseLuaToDrawCommands,
  isInterpretationReliable,
  getLastPreviewParseMeta,
  COLOR_MAP,
  type DrawRecord,
} from "./index.ts";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..", "..", "..");
const EXAMPLES = join(ROOT, "examples");

const EXAMPLE_FILES = readdirSync(EXAMPLES)
  .filter((f) => f.endsWith(".lua"))
  .sort();

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
        r.opacity ?? "",
        (r.text ?? "").slice(0, 32),
        r.color ?? "",
      ];
      return parts.join("|");
    });
  return createHash("sha256").update(lines.join("\n")).digest("hex");
}

describe("example dashboards — parser reliability suite", () => {
  for (const file of EXAMPLE_FILES) {
    it(`${file} interprets reliably for editor-preview scenario`, () => {
      const path = join(EXAMPLES, file);
      assert.ok(existsSync(path), `missing example ${file}`);
      const source = readFileSync(path, "utf8");
      const records = parseLuaToDrawCommands(source, EDITOR_PREVIEW_SCENARIO);
      const meta = getLastPreviewParseMeta();
      assert.ok(records.length > 2, `${file}: expected draw records`);
      assert.equal(
        meta.skippedTextCount,
        0,
        `${file}: skipped text ${meta.warnings.slice(0, 3).join("; ")}`,
      );
      assert.ok(
        isInterpretationReliable(records, meta.skippedTextCount),
        `${file}: unreliable interpretation`,
      );
    });

    it(`${file} fingerprint is stable`, () => {
      const source = readFileSync(join(EXAMPLES, file), "utf8");
      const a = fingerprintRecords(
        parseLuaToDrawCommands(source, EDITOR_PREVIEW_SCENARIO),
      );
      const b = fingerprintRecords(
        parseLuaToDrawCommands(source, EDITOR_PREVIEW_SCENARIO),
      );
      assert.equal(a, b);
    });

    it(`${file} uses EdgeTX-aligned greys when present`, () => {
      const source = readFileSync(join(EXAMPLES, file), "utf8");
      const records = parseLuaToDrawCommands(source, EDITOR_PREVIEW_SCENARIO);
      const greys = records.filter(
        (r) => r.color === COLOR_MAP.GREY || r.color === COLOR_MAP.DARKGREY,
      );
      if (/\bDARKGREY\b|\bGREY\b/.test(source)) {
        assert.ok(
          greys.length > 0,
          `${file}: expected GREY/DARKGREY draws to resolve to firmware hex`,
        );
      }
      for (const g of greys) {
        assert.ok(
          g.color === "#606060" || g.color === "#404040",
          `${file}: unexpected grey ${g.color}`,
        );
      }
    });
  }
});
