import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EDGETX_KEY_EXIT, pulseSimKey, pulseSimKeyExit } from "./simKeys.ts";
import type { SimInputMessage } from "./types.ts";

describe("simKeys", () => {
  it("pulses press then release", () => {
    const msgs: SimInputMessage[] = [];
    pulseSimKey((msg) => msgs.push(msg), 2);
    assert.deepEqual(msgs, [
      { type: "simKey", key: 2, state: 1 },
      { type: "simKey", key: 2, state: 0 },
    ]);
  });

  it("pulses KEY_EXIT for dismiss", () => {
    const msgs: SimInputMessage[] = [];
    pulseSimKeyExit((msg) => msgs.push(msg));
    assert.equal(EDGETX_KEY_EXIT, 1);
    assert.deepEqual(msgs, [
      { type: "simKey", key: 1, state: 1 },
      { type: "simKey", key: 1, state: 0 },
    ]);
  });
});
