/// <reference lib="webworker" />

import {
  SimRuntime,
  type SimWorkerRequest,
  type SimWorkerResponse,
  type MockTelemetryValues,
} from "@widget-gen/sim-preview";

let runtime: SimRuntime | null = null;
let currentMock: MockTelemetryValues | null = null;

function post(msg: SimWorkerResponse, transfer?: Transferable[]): void {
  self.postMessage(msg, transfer ?? []);
}

self.onmessage = (event: MessageEvent<SimWorkerRequest>) => {
  const msg = event.data;
  void handleMessage(msg);
};

async function handleMessage(msg: SimWorkerRequest): Promise<void> {
  try {
    switch (msg.type) {
      case "init": {
        if (runtime) {
          await runtime.dispose();
        }
        runtime = new SimRuntime(msg.wasmUrl, msg.radioKey, {
          onState: (state) => post({ type: "state", state }),
          onFrame: (frame) =>
            post({ type: "frame", frame }, [frame.buffer]),
          onLog: (text) => post({ type: "log", text }),
        });
        if (msg.mock) {
          currentMock = msg.mock;
        }
        await runtime.init(
          msg.source || msg.mock
            ? {
                source: msg.source,
                zone: msg.zone,
                mock: msg.mock ?? currentMock ?? undefined,
              }
            : undefined
        );
        if (currentMock) {
          runtime.setMockTelemetry(currentMock);
        }
        break;
      }
      case "loadWidget": {
        if (!runtime) throw new Error("Simulator not initialized");
        await runtime.loadWidget(msg.source, msg.zone);
        if (currentMock) runtime.setMockTelemetry(currentMock);
        break;
      }
      case "setMock": {
        currentMock = msg.mock;
        runtime?.setMockTelemetry(msg.mock);
        break;
      }
      case "input": {
        runtime?.handleInput(msg.msg);
        break;
      }
      case "pause": {
        runtime?.pause();
        break;
      }
      case "resume": {
        runtime?.resume();
        break;
      }
      case "dispose": {
        await runtime?.dispose();
        runtime = null;
        currentMock = null;
        post({ type: "state", state: { phase: "idle", progress: 0, status: "", error: null, keyboardMode: "none" } });
        break;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    post({
      type: "state",
      state: { phase: "error", progress: 0, status: "Error", error: message, keyboardMode: "none" },
    });
    post({ type: "error", message });
  }
};
