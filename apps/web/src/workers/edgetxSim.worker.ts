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
        await runtime.init(
          msg.source
            ? { source: msg.source, zone: msg.zone }
            : undefined
        );
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
      case "dispose": {
        await runtime?.dispose();
        runtime = null;
        currentMock = null;
        post({ type: "state", state: { phase: "idle", progress: 0, status: "", error: null } });
        break;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    post({
      type: "state",
      state: { phase: "error", progress: 0, status: "Error", error: message },
    });
    post({ type: "error", message });
  }
};
