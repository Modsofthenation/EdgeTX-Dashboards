import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { listPrefabSections } from "@widget-gen/editor-core";
import { prefabBoardPreviewSrc, prefabPreviewSrc } from "./prefabPreview.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicRoot = join(__dirname, "..", "..", "public");

describe("prefab Insert previews", () => {
  it("ships a cropped PNG for every registered prefab section", () => {
    const sections = listPrefabSections();
    assert.ok(sections.length >= 8);
    for (const prefab of sections) {
      assert.equal(prefabPreviewSrc(prefab.id), `/prefabs/${prefab.id}.png`);
      const file = join(publicRoot, "prefabs", `${prefab.id}.png`);
      assert.ok(existsSync(file), `missing prefab thumb: ${file}`);
    }
  });

  it("ships board composite PNGs for full-board Insert actions", () => {
    for (const id of [
      "rf-heli-electric",
      "rf-heli-nitro",
      "whoop",
      "freestyle-quad",
      "minimal-quad",
      "dense-crsf",
    ]) {
      assert.equal(prefabBoardPreviewSrc(id), `/prefabs/boards/${id}.png`);
      const file = join(publicRoot, "prefabs", "boards", `${id}.png`);
      assert.ok(existsSync(file), `missing board thumb: ${file}`);
    }
  });
});
