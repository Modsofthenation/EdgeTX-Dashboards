import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("drawAnnulus QA fixture", () => {
  it("contains drawAnnulus in refresh for manual Radio sim QA", () => {
    const source = readFileSync(join(FIXTURE_DIR, "drawAnnulusQa.lua"), "utf8");
    assert.match(source, /---@simulate Layout1x1 zone=0/);
    assert.match(source, /lcd\.drawAnnulus/);
    assert.match(source, /name\s*=\s*["']AnnulusQA["']/);
  });
});
