import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SimRuntime } from "../SimRuntime.ts";
import type { WasmRunner } from "@edgetx/simulator-ui";

function mockRuntime(): {
  runtime: SimRuntime;
  analog: { index: number; value: number }[];
  calls: string[];
} {
  const analog: { index: number; value: number }[] = [];
  const calls: string[] = [];

  const exports = {
    simuSetSwitch: (index: number, state: number) => {
      calls.push(`switch:${index}:${state}`);
    },
    simuSetKey: (key: number, state: number) => {
      calls.push(`key:${key}:${state}`);
    },
    simuSetTrim: (trim: number, state: number) => {
      calls.push(`trim:${trim}:${state}`);
    },
    simuRotaryEncoderEvent: (steps: number) => {
      calls.push(`rotary:${steps}`);
    },
    simuInjectChar: (code: number) => {
      calls.push(`char:${code}`);
    },
    simuTouchDown: (x: number, y: number) => {
      calls.push(`touchDown:${x},${y}`);
    },
    simuTouchUp: () => {
      calls.push("touchUp");
    },
  };

  const runner = {
    setAnalog: (index: number, value: number) => {
      analog.push({ index, value });
    },
    exports,
  } as unknown as WasmRunner;

  const runtime = new SimRuntime("/sim/test.wasm", "tx15");
  (runtime as unknown as { runner: WasmRunner | null }).runner = runner;

  return { runtime, analog, calls };
}

describe("SimRuntime.handleInput", () => {
  it("routes simAnalog to runner.setAnalog with clamped value", () => {
    const { runtime, analog } = mockRuntime();
    runtime.handleInput({ type: "simAnalog", index: 2, value: 5000 });
    assert.equal(analog.length, 1);
    assert.equal(analog[0]?.index, 2);
    assert.equal(analog[0]?.value, 4096);
  });

  it("routes simKey to simuSetKey", () => {
    const { runtime, calls } = mockRuntime();
    runtime.handleInput({ type: "simKey", key: 2, state: 1 });
    assert.deepEqual(calls, ["key:2:1"]);
  });

  it("routes simTouch to simuTouchDown and simTouchUp", () => {
    const { runtime, calls } = mockRuntime();
    runtime.handleInput({ type: "simTouch", x: 120, y: 160 });
    runtime.handleInput({ type: "simTouchUp" });
    assert.deepEqual(calls, ["touchDown:120,160", "touchUp"]);
  });

  it("no-ops when runner is not ready", () => {
    const runtime = new SimRuntime("/sim/test.wasm", "tx15");
    assert.doesNotThrow(() => {
      runtime.handleInput({ type: "simKey", key: 1, state: 1 });
    });
  });
});
