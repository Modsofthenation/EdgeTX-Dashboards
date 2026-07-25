import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildSimModelYaml,
  buildScreenDataYaml,
  SIM_CUSTOM_SCREEN_VIEW,
  SIM_TELEMETRY_SENSOR_LABELS,
} from "./simModel.ts";

describe("simModel", () => {
  it("buildScreenDataYaml assigns widget to layout zone", () => {
    const yaml = buildScreenDataYaml("Layout2x2", 1, "BfModel");
    assert.match(yaml, /LayoutId: Layout2x2/);
    assert.match(yaml, /"1":/);
    assert.match(yaml, /widgetName: BfModel/);
    assert.match(yaml, new RegExp(`view: ${SIM_CUSTOM_SCREEN_VIEW}`));
  });

  it("buildSimModelYaml includes CRSF sensors and optional screenData", () => {
    const withWidget = buildSimModelYaml({
      widgetName: "TX15Dash",
      layoutId: "Layout1x1",
      zoneIndex: 0,
    });
    assert.match(withWidget, /TYPE_CROSSFIRE/);
    for (const label of SIM_TELEMETRY_SENSOR_LABELS) {
      assert.ok(
        withWidget.includes(`label: ${label}`),
        `missing sensor ${label}`,
      );
    }
    assert.match(withWidget, /screenData:/);
    assert.match(withWidget, /widgetName: TX15Dash/);

    const baseOnly = buildSimModelYaml();
    assert.doesNotMatch(baseOnly, /screenData:/);
  });

  it("buildSimModelYaml uses requested EdgeTX semver", () => {
    const yaml = buildSimModelYaml(undefined, "2.12.0");
    assert.match(yaml, /^semver: 2\.12\.0$/m);
  });
});
