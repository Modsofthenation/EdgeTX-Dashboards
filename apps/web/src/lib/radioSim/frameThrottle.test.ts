import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createFrameThrottle, FRAME_MIN_INTERVAL_MS } from "./frameThrottle.ts";

describe("createFrameThrottle", () => {
  it("emits immediately then coalesces to the latest pending frame", () => {
    const emitted: number[] = [];
    let now = 0;
    const timers = new Map<ReturnType<typeof setTimeout>, () => void>();
    let nextId = 1;

    const throttle = createFrameThrottle<number>(
      (frame) => emitted.push(frame),
      FRAME_MIN_INTERVAL_MS,
      {
        now: () => now,
        setTimeout: (fn) => {
          const id = nextId++ as unknown as ReturnType<typeof setTimeout>;
          timers.set(id, fn);
          return id;
        },
        clearTimeout: (id) => {
          timers.delete(id);
        },
      },
    );

    throttle.push(1);
    assert.deepEqual(emitted, [1]);

    throttle.push(2);
    throttle.push(3);
    assert.deepEqual(emitted, [1]);
    assert.equal(timers.size, 1);

    now = FRAME_MIN_INTERVAL_MS;
    for (const fn of timers.values()) fn();
    timers.clear();
    assert.deepEqual(emitted, [1, 3]);
  });

  it("reset clears pending emission", () => {
    const emitted: number[] = [];
    let now = 0;
    const timers = new Map<ReturnType<typeof setTimeout>, () => void>();
    let nextId = 1;

    const throttle = createFrameThrottle<number>(
      (frame) => emitted.push(frame),
      10,
      {
        now: () => now,
        setTimeout: (fn) => {
          const id = nextId++ as unknown as ReturnType<typeof setTimeout>;
          timers.set(id, fn);
          return id;
        },
        clearTimeout: (id) => {
          timers.delete(id);
        },
      },
    );

    throttle.push(1);
    throttle.push(2);
    throttle.reset();
    now = 100;
    for (const fn of timers.values()) fn();
    assert.deepEqual(emitted, [1]);
  });
});
