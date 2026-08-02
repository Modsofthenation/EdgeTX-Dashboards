import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));

describe("useRadioSim dispose keeps frame subscription", () => {
  it("clears latest frame via hub without dropping the subscriber", () => {
    const src = readFileSync(join(dir, "useRadioSim.ts"), "utf8");
    const disposeFn = src.match(
      /const dispose = useCallback\(\(\) => \{([\s\S]*?)\}, \[dropWorker\]\);/,
    )?.[1];
    assert.ok(disposeFn, "dispose callback not found");
    assert.match(disposeFn!, /clearLatest\(\)/);
    assert.doesNotMatch(disposeFn!, /subscribe\(null\)/);
    assert.doesNotMatch(disposeFn!, /frameSubscriberRef\.current = null/);
  });
});
