import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

describe("fullscreen double-tap gesture", () => {
  it("completes with a second touchUp and holds KEY_EXIT before tapping", () => {
    const src = readFileSync(join(root, "SimRuntime.ts"), "utf8");
    assert.match(
      src,
      /case 6:\s*ex\.simuTouchUp\(\);\s*this\.finishFullscreenTap/s,
    );
    assert.doesNotMatch(src, /FULLSCREEN_MAX_ATTEMPTS/);
    assert.doesNotMatch(src, /retrying widget fullscreen double-tap/);
    assert.doesNotMatch(src, /attempt:/);
    assert.match(src, /KEY_EXIT_HOLD_FRAMES/);
    assert.match(src, /simuSetKey\(EDGETX_KEY_EXIT,\s*1\)/);
    assert.match(src, /simuSetKey\?\.\(EDGETX_KEY_EXIT,\s*0\)/);
  });
});
