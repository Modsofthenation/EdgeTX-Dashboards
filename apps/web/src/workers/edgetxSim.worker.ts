/// <reference lib="webworker" />

import {
  SimRuntime,
  type SimWorkerRequest,
  type SimWorkerResponse,
  type MockTelemetryValues,
  type SimFrameData,
  type WidgetSimulateZone,
} from "@widget-gen/sim-preview";
import {
  createFrameThrottle,
  FRAME_MIN_INTERVAL_MS,
} from "../lib/radioSim/frameThrottle.ts";
import { createLoadWidgetCoalescer } from "../lib/radioSim/loadWidgetCoalesce.ts";

let runtime: SimRuntime | null = null;
let currentMock: MockTelemetryValues | null = null;
let commandQueue: Promise<void> = Promise.resolve();
let frameThrottle = createFrameThrottle<SimFrameData>((frame) => {
  post({ type: "frame", frame }, [frame.buffer]);
}, FRAME_MIN_INTERVAL_MS);

const loadWidgetCoalescer = createLoadWidgetCoalescer<WidgetSimulateZone>({
  run: async (job) => {
    if (!runtime) throw new Error("Simulator not initialized");
    await runtime.loadWidget(
      job.source,
      job.zone,
      job.modelPng ? new Uint8Array(job.modelPng) : undefined,
    );
    if (currentMock) runtime.setMockTelemetry(currentMock);
  },
  onResult: (requestId, result) => {
    if (result.ok) {
      post({ type: "loadWidgetResult", requestId, ok: true });
    } else {
      post({
        type: "log",
        text: `Widget reload failed: ${result.error}`,
      });
      post({
        type: "loadWidgetResult",
        requestId,
        ok: false,
        error: result.error,
      });
    }
  },
});

function post(msg: SimWorkerResponse, transfer?: Transferable[]): void {
  self.postMessage(msg, transfer ?? []);
}

self.onmessage = (event: MessageEvent<SimWorkerRequest>) => {
  const msg = event.data;
  // Coalesce outside the serial command queue so rapid editor edits collapse
  // to the latest source instead of each awaiting a full deploy.
  if (msg.type === "loadWidget") {
    loadWidgetCoalescer.enqueue({
      source: msg.source,
      zone: msg.zone,
      requestId: msg.requestId,
      modelPng: msg.modelPng,
    });
    return;
  }

  commandQueue = commandQueue
    .then(() => handleMessage(msg))
    .catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      post({
        type: "state",
        state: {
          phase: "error",
          progress: 0,
          status: "Error",
          error: message,
          keyboardMode: "none",
        },
      });
      post({ type: "error", message });
    });
};

async function handleMessage(msg: SimWorkerRequest): Promise<void> {
  try {
    switch (msg.type) {
      case "init": {
        loadWidgetCoalescer.reset("re-init");
        frameThrottle.reset();
        if (runtime) {
          await runtime.dispose();
        }
        runtime = new SimRuntime(msg.wasmUrl, msg.radioKey, {
          onState: (state) => post({ type: "state", state }),
          onFrame: (frame) => frameThrottle.push(frame),
          onLog: (text) => post({ type: "log", text }),
        });
        if (msg.mock) {
          currentMock = msg.mock;
        }
        const initModelPng = msg.modelPng
          ? new Uint8Array(msg.modelPng)
          : undefined;
        await runtime.init(
          msg.source || msg.mock || initModelPng || msg.edgeTxVersion
            ? {
                source: msg.source,
                zone: msg.zone,
                mock: msg.mock ?? currentMock ?? undefined,
                edgeTxVersion: msg.edgeTxVersion,
                modelPng: initModelPng,
              }
            : undefined,
        );
        if (currentMock) {
          runtime.setMockTelemetry(currentMock);
        }
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
      case "enterWidgetFullscreen": {
        runtime?.requestEnterWidgetFullscreen();
        break;
      }
      case "dispose": {
        loadWidgetCoalescer.reset("disposed");
        frameThrottle.reset();
        await runtime?.dispose();
        runtime = null;
        currentMock = null;
        post({
          type: "state",
          state: {
            phase: "idle",
            progress: 0,
            status: "",
            error: null,
            keyboardMode: "none",
          },
        });
        break;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    post({
      type: "state",
      state: {
        phase: "error",
        progress: 0,
        status: "Error",
        error: message,
        keyboardMode: "none",
      },
    });
    post({ type: "error", message });
  }
}
