import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapWidgetRelPathToZipPath } from "./packageEntries.ts";

describe("mapWidgetRelPathToZipPath", () => {
  it("maps main.lua and INSTALL.md under WIDGETS/", () => {
    assert.equal(
      mapWidgetRelPathToZipPath("Dash", "main.lua"),
      "WIDGETS/Dash/main.lua",
    );
    assert.equal(
      mapWidgetRelPathToZipPath("Dash", "INSTALL.md"),
      "WIDGETS/Dash/INSTALL.md",
    );
  });

  it("maps tools/ and telemetry/ companions to SCRIPTS/", () => {
    assert.equal(
      mapWidgetRelPathToZipPath("Dash", "tools/flt_count.lua"),
      "SCRIPTS/TOOLS/flt_count.lua",
    );
    assert.equal(
      mapWidgetRelPathToZipPath("Dash", "telemetry/batt_voice.lua"),
      "SCRIPTS/TELEMETRY/batt_voice.lua",
    );
  });

  it("maps images/ and IMAGES/ to zip IMAGES/", () => {
    assert.equal(
      mapWidgetRelPathToZipPath("Dash", "images/heli.png"),
      "IMAGES/heli.png",
    );
    assert.equal(
      mapWidgetRelPathToZipPath("Dash", "IMAGES/simmodel.png"),
      "IMAGES/simmodel.png",
    );
  });
});
