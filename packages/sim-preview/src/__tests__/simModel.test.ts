import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SIM_MODEL1_YML,
  SIM_TELEMETRY_SENSOR_LABELS,
  deploySimModel,
  patchRadioInternalCrsf,
} from "../simModel.js";

describe("simModel", () => {
  it("includes CRSF internal module and widget sensor labels", () => {
    assert.match(SIM_MODEL1_YML, /type: TYPE_CROSSFIRE/);
    for (const label of SIM_TELEMETRY_SENSOR_LABELS) {
      assert.match(SIM_MODEL1_YML, new RegExp(`label: ${label.replace(/[%]/g, "%")}`));
    }
  });

  it("deploySimModel writes model1.yml", async () => {
    const writes: Array<{ path: string; data: string }> = [];
    await deploySimModel({
      fsWriteFile: async (path, buf) => {
        writes.push({ path, data: new TextDecoder().decode(buf) });
      },
    });
    assert.equal(writes.length, 1);
    assert.equal(writes[0]?.path, "/MODELS/model1.yml");
    assert.match(writes[0]?.data ?? "", /TYPE_CROSSFIRE/);
  });

  it("patchRadioInternalCrsf updates internalModule", async () => {
    let radio = "semver: 2.11.0\nheader:\n  name: Radio\n";
    await patchRadioInternalCrsf({
      fsWriteFile: async (path, buf) => {
        assert.equal(path, "/RADIO/radio.yml");
        radio = new TextDecoder().decode(buf);
      },
      fsReadFile: async () => new TextEncoder().encode(radio).buffer,
    });
    assert.match(radio, /internalModule: TYPE_CROSSFIRE/);
  });
});
