import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SIM_OPFS_HANDOFF_MS,
  isModalSimHandoffReady,
  shouldMountInlineRadioSim,
} from "./simOpfsHandoff.ts";

describe("simOpfsHandoff", () => {
  it("keeps a positive handoff delay before second OPFS init", () => {
    assert.ok(SIM_OPFS_HANDOFF_MS >= 50);
    assert.ok(SIM_OPFS_HANDOFF_MS <= 250);
  });

  it("unmounts inline radio preview while the simulator modal is open", () => {
    assert.equal(
      shouldMountInlineRadioSim({
        inlineSimEnabled: true,
        simModalOpen: true,
        hasColorWasm: true,
      }),
      false,
    );
    assert.equal(
      shouldMountInlineRadioSim({
        inlineSimEnabled: true,
        simModalOpen: false,
        hasColorWasm: true,
      }),
      true,
    );
    assert.equal(
      shouldMountInlineRadioSim({
        inlineSimEnabled: true,
        simModalOpen: false,
        inlineRuntimeReady: false,
        hasColorWasm: true,
      }),
      false,
    );
    assert.equal(
      shouldMountInlineRadioSim({
        inlineSimEnabled: false,
        simModalOpen: false,
        hasColorWasm: true,
      }),
      false,
    );
    assert.equal(
      shouldMountInlineRadioSim({
        inlineSimEnabled: true,
        simModalOpen: false,
        hasColorWasm: false,
      }),
      false,
    );
  });

  it("blocks modal remount until the current reloadKey finishes handoff", () => {
    assert.equal(
      isModalSimHandoffReady({
        open: true,
        reloadKey: 0,
        completedReloadKey: 0,
      }),
      true,
    );
    // Reload bump: previous ready key must not authorize the new instance.
    assert.equal(
      isModalSimHandoffReady({
        open: true,
        reloadKey: 1,
        completedReloadKey: 0,
      }),
      false,
    );
    assert.equal(
      isModalSimHandoffReady({
        open: true,
        reloadKey: 1,
        completedReloadKey: null,
      }),
      false,
    );
    assert.equal(
      isModalSimHandoffReady({
        open: true,
        reloadKey: 1,
        completedReloadKey: 1,
      }),
      true,
    );
    assert.equal(
      isModalSimHandoffReady({
        open: false,
        reloadKey: 1,
        completedReloadKey: 1,
      }),
      false,
    );
  });
});
