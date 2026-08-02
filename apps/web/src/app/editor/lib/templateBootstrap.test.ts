import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getSimulateLayoutProfile,
  isFullLcdSimulateZone,
  resolvePreviewDimensions,
} from "@widget-gen/shared";
import { TEMPLATE_GALLERY } from "~/lib/templateGallery";
import { resolveTemplateEditorBootstrap } from "./templateBootstrap.ts";

describe("resolveTemplateEditorBootstrap", () => {
  const lcd = { lcdW: 480, lcdH: 320 };

  it("returns full-LCD Layout1x1 boards for every gallery template", () => {
    const profile = getSimulateLayoutProfile("tx15");
    for (const item of TEMPLATE_GALLERY) {
      const boot = resolveTemplateEditorBootstrap(item.id, lcd);
      assert.ok(boot, `${item.id} should resolve`);
      assert.equal(boot.protocol, item.protocol);
      assert.match(boot.source, /---@simulate Layout1x1 zone=0/);
      const dims = resolvePreviewDimensions(boot.source, profile);
      assert.equal(
        isFullLcdSimulateZone(dims),
        true,
        `${item.id} should be full-LCD simulate zone`,
      );
    }
  });

  it("uses a prefab shell for RF heli (not starter cards)", () => {
    const electric = resolveTemplateEditorBootstrap("heli-electric", lcd);
    assert.ok(electric);
    assert.doesNotMatch(electric.source, /DashStart/);
    assert.match(electric.source, /RfHeliE|Governor|Headspeed|AMPS/i);
    assert.deepEqual(electric.companionSuites, ["rf-heli-electric"]);
  });
});
