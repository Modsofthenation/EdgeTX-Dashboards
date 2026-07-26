import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  TEMPLATE_GALLERY,
  templatePreviewSrc,
} from "./templateGallery.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicTemplates = join(__dirname, "..", "..", "public", "templates");

describe("TEMPLATE_GALLERY", () => {
  it("assigns a protocol to every template", () => {
    for (const item of TEMPLATE_GALLERY) {
      assert.ok(
        item.protocol === "betaflight" ||
          item.protocol === "rotorflight" ||
          item.protocol === "generic-crsf",
        `${item.id} missing protocol`,
      );
    }
  });

  it("maps Rotorflight heli templates to rotorflight", () => {
    const electric = TEMPLATE_GALLERY.find((i) => i.id === "heli-electric");
    const nitro = TEMPLATE_GALLERY.find((i) => i.id === "heli-nitro");
    assert.equal(electric?.protocol, "rotorflight");
    assert.equal(nitro?.protocol, "rotorflight");
  });

  it("maps freestyle/whoop quads to betaflight", () => {
    const freestyle = TEMPLATE_GALLERY.find((i) => i.id === "freestyle-quad");
    const whoop = TEMPLATE_GALLERY.find((i) => i.id === "whoop");
    assert.equal(freestyle?.protocol, "betaflight");
    assert.equal(whoop?.protocol, "betaflight");
  });

  it("gives every template a distinct complete layout prefab", () => {
    const prefabs = TEMPLATE_GALLERY.map((item) => {
      assert.ok(item.layoutPrefab, `${item.id} missing layoutPrefab`);
      return item.layoutPrefab!;
    });
    assert.equal(new Set(prefabs).size, prefabs.length);
    for (const item of TEMPLATE_GALLERY) {
      if (item.id === "heli-electric" || item.id === "heli-nitro") continue;
      assert.notEqual(
        item.layoutPrefab,
        "starter",
        `${item.id} should not use header-only starter`,
      );
    }
  });

  it("ships a PNG preview for every gallery template", () => {
    for (const item of TEMPLATE_GALLERY) {
      assert.equal(templatePreviewSrc(item.id), `/templates/${item.id}.png`);
      const file = join(publicTemplates, `${item.id}.png`);
      assert.ok(existsSync(file), `missing preview PNG: ${file}`);
    }
  });
});
