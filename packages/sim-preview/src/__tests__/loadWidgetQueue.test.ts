import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SimRuntime } from "../SimRuntime.ts";

describe("SimRuntime loadWidget queue", () => {
  it("recovers queue after a failed reload", async () => {
    const runtime = new SimRuntime("about:blank", "tx15");
    let calls = 0;

    (runtime as unknown as { flushPendingLoadWidget: () => Promise<void> }).flushPendingLoadWidget =
      async () => {
        calls += 1;
        if (calls === 1) {
          throw new Error("first reload failed");
        }
      };

    await assert.rejects(runtime.loadWidget("first"), /first reload failed/);
    await assert.doesNotReject(runtime.loadWidget("second"));
    assert.equal(calls, 2);
  });
});
