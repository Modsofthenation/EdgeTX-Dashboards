import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RadioSimFrameHub } from "./frameHub.ts";
import type { SimFrameData } from "@widget-gen/sim-preview";

function frame(id: number): SimFrameData {
  return {
    buffer: new ArrayBuffer(4),
    width: id,
    height: 1,
    depth: 16,
  };
}

describe("RadioSimFrameHub", () => {
  it("delivers frames to the active subscriber", () => {
    const hub = new RadioSimFrameHub();
    const seen: number[] = [];
    hub.subscribe((f) => seen.push(f.width));
    hub.publish(frame(1));
    hub.publish(frame(2));
    assert.deepEqual(seen, [1, 2]);
  });

  it("keeps the subscriber after clearLatest (dispose/reboot)", () => {
    const hub = new RadioSimFrameHub();
    const seen: number[] = [];
    hub.subscribe((f) => seen.push(f.width));
    hub.publish(frame(3));
    hub.clearLatest();
    assert.equal(hub.hasSubscriber, true);
    assert.equal(hub.latestFrame, null);
    hub.publish(frame(4));
    assert.deepEqual(seen, [3, 4]);
  });

  it("replays latest frame when a subscriber attaches", () => {
    const hub = new RadioSimFrameHub();
    hub.publish(frame(9));
    const seen: number[] = [];
    hub.subscribe((f) => seen.push(f.width));
    assert.deepEqual(seen, [9]);
  });
});
