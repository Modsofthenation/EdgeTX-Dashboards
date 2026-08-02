import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));

describe("simulator modal OPFS exclusivity", () => {
  it("defers modal WASM mount with the shared handoff delay", () => {
    const src = readFileSync(
      join(dir, "components/SimVerifyModal.tsx"),
      "utf8",
    );
    assert.match(src, /SIM_OPFS_HANDOFF_MS/);
    assert.match(src, /isModalSimHandoffReady/);
    assert.match(src, /completedReloadKey/);
    assert.match(src, /sim-opfs-handoff/);
  });

  it("gates inline radio preview on modal open + post-close handoff", () => {
    const src = readFileSync(join(dir, "EditorApp.tsx"), "utf8");
    assert.match(src, /shouldMountInlineRadioSim/);
    assert.match(src, /inlineSimRuntimeReady/);
    assert.match(src, /SIM_OPFS_HANDOFF_MS/);
    assert.match(src, /inlineRuntimeReady:\s*inlineSimRuntimeReady/);
    // Opening must not force a remount key bump (reload stays on Reload button).
    assert.doesNotMatch(
      src,
      /const openSim = useCallback\(\(\) => \{[^}]*setSimReloadKey/s,
    );
  });
});
