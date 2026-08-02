import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

describe("fullscreen double-tap gesture", () => {
  it("completes with a second touchUp and does not blind-retry", () => {
    const src = readFileSync(join(root, "SimRuntime.ts"), "utf8");
    assert.match(
      src,
      /case 5:\s*ex\.simuTouchUp\(\);\s*this\.finishFullscreenTap/s,
    );
    assert.doesNotMatch(src, /FULLSCREEN_MAX_ATTEMPTS/);
    assert.doesNotMatch(src, /retrying widget fullscreen double-tap/);
    assert.match(src, /simuSetKey\(1,\s*1\)/);
  });
});
