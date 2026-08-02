import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import {
  EDGETX_KEY_EXIT,
  SIM_KEY_PULSE_MS,
  pulseSimKey,
  pulseSimKeyExit,
} from "./simKeys.ts";
import type { SimInputMessage } from "./types.ts";

describe("simKeys", () => {
  it("pulses press then delayed release", () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    try {
      const msgs: SimInputMessage[] = [];
      pulseSimKey((msg) => msgs.push(msg), 2);
      assert.deepEqual(msgs, [{ type: "simKey", key: 2, state: 1 }]);
      mock.timers.tick(SIM_KEY_PULSE_MS);
      assert.deepEqual(msgs, [
        { type: "simKey", key: 2, state: 1 },
        { type: "simKey", key: 2, state: 0 },
      ]);
    } finally {
      mock.timers.reset();
    }
  });

  it("supports immediate release when holdMs is 0", () => {
    const msgs: SimInputMessage[] = [];
    pulseSimKey((msg) => msgs.push(msg), 2, 0);
    assert.deepEqual(msgs, [
      { type: "simKey", key: 2, state: 1 },
      { type: "simKey", key: 2, state: 0 },
    ]);
  });

  it("pulses KEY_EXIT for dismiss", () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    try {
      const msgs: SimInputMessage[] = [];
      pulseSimKeyExit((msg) => msgs.push(msg));
      assert.equal(EDGETX_KEY_EXIT, 1);
      assert.deepEqual(msgs, [{ type: "simKey", key: 1, state: 1 }]);
      mock.timers.tick(SIM_KEY_PULSE_MS);
      assert.deepEqual(msgs, [
        { type: "simKey", key: 1, state: 1 },
        { type: "simKey", key: 1, state: 0 },
      ]);
    } finally {
      mock.timers.reset();
    }
  });
});
