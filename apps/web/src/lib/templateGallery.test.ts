import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TEMPLATE_GALLERY } from "./templateGallery.ts";

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
});
