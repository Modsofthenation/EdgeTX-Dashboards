import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createPrefabShellSource,
  insertPrefabSections,
  scaleLcdCoordsInLine,
  scalePrefabSection,
  getPrefabSection,
  WHOOP_LAYOUT_ORDER,
  ROTORFLIGHT_ELECTRIC_LAYOUT_ORDER,
  formatPrefabCatalogForPrompt,
} from "./index.ts";

describe("scalePrefabSection", () => {
  it("scales Y geometry from 320 to 272", () => {
    const raw = getPrefabSection("rf-battery-bar");
    assert.ok(raw);
    const scaled = scalePrefabSection(raw, 480, 272);
    assert.equal(scaled.defaultBounds.y, Math.round((raw.defaultBounds.y * 272) / 320));
    assert.ok(
      scaled.refreshLines.some((l) => /lcd\.drawFilledRectangle\(/.test(l)),
    );
  });

  it("leaves TX15 size unchanged", () => {
    const raw = getPrefabSection("quad-topbar");
    assert.ok(raw);
    const scaled = scalePrefabSection(raw, 480, 320);
    assert.equal(scaled, raw);
  });

  it("scales lcd.drawText coordinates in a line", () => {
    const out = scaleLcdCoordsInLine('lcd.drawText(12, 56, "MODEL", SMLSIZE)', 1, 272 / 320);
    assert.match(out, /lcd\.drawText\(12, 48,/);
  });
});

describe("formatPrefabCatalogForPrompt", () => {
  it("includes RF board recipes for rotorflight", () => {
    const md = formatPrefabCatalogForPrompt("rotorflight");
    assert.match(md, /composeWidgetFromPrefabs/);
    assert.match(md, /rf-headspeed-hero/);
    assert.match(md, /RF heli electric/);
  });

  it("includes whoop/dense recipes for betaflight", () => {
    const md = formatPrefabCatalogForPrompt("betaflight");
    assert.match(md, /Whoop/);
    assert.match(md, /quad-armed-banner/);
    assert.match(md, /Dense CRSF/);
  });
});

describe("insertPrefabSections color272", () => {
  it("assembles RF electric board scaled to 272 height", () => {
    const shell = createPrefabShellSource("Rf272");
    const { source, inserted } = insertPrefabSections(
      shell,
      [...ROTORFLIGHT_ELECTRIC_LAYOUT_ORDER],
      { lcdW: 480, lcdH: 272 },
    );
    assert.deepEqual(inserted, [...ROTORFLIGHT_ELECTRIC_LAYOUT_ORDER]);
    assert.match(source, /-- prefab:rf-headspeed-hero/);
    // TX15 footer drawText y=272 must scale down on a 272-tall LCD.
    assert.doesNotMatch(source, /lcd\.drawText\(\s*240\s*,\s*272\s*,/);
    assert.match(source, /lcd\.drawText\(\s*240\s*,\s*231\s*,/);
  });

  it("assembles whoop board at TX15 by default", () => {
    const shell = createPrefabShellSource("Whoop");
    const { inserted } = insertPrefabSections(shell, [...WHOOP_LAYOUT_ORDER]);
    assert.deepEqual(inserted, [...WHOOP_LAYOUT_ORDER]);
  });
});
