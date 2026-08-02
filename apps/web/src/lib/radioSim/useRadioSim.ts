"use client";

import { useCallback, useRef, useState } from "react";
import type {
  MockTelemetryValues,
  RadioSimState,
  SimFrameData,
  SimInputMessage,
  SimWorkerRequest,
  SimWorkerResponse,
  WidgetSimulateZone,
} from "@widget-gen/sim-preview";
import { DEFAULT_EDGE_TX_VERSION } from "~/lib/edgeTxVersions";
import {
  resolveSimFirmware,
  type SimFirmwareResolution,
  type SimManifest,
} from "~/lib/radioSim/simFirmware";
import { resolveReachableWasmUrl } from "~/lib/radioSim/resolveWasmUrl";

const DEFAULT_STATE: RadioSimState = {
  phase: "idle",
  progress: 0,
  status: "",
  error: null,
  keyboardMode: "none",
};

export type FrameSubscriber = (frame: SimFrameData) => void;

export type RadioSimInitOptions = {
  source: string;
  zone?: WidgetSimulateZone;
  mock?: MockTelemetryValues;
  edgeTxVersion?: string;
  /** knowledge/radios id — selects color WASM flavour when available. */
  radioId?: string;
  /** Optional model PNG written to /IMAGES/simmodel.png on the virtual SD. */
  modelPng?: Uint8Array;
};

let manifestPromise: Promise<SimManifest> | null = null;

function fetchSimManifest(): Promise<SimManifest> {
  if (!manifestPromise) {
    manifestPromise = fetch("/sim/manifest.json")
      .then((response) => {
        if (!response.ok)
          throw new Error(`Failed to load sim manifest (${response.status})`);
        return response.json() as Promise<SimManifest>;
      })
      .catch((err) => {
        manifestPromise = null;
        throw err;
      });
  }
  return manifestPromise;
}

export function useRadioSim() {
  const workerRef = useRef<Worker | null>(null);
  const frameRef = useRef<SimFrameData | null>(null);
  const frameSubscriberRef = useRef<FrameSubscriber | null>(null);
  const nextLoadRequestIdRef = useRef(1);
  const pendingLoadRef = useRef(
    new Map<number, { resolve: () => void; reject: (err: Error) => void }>(),
  );
  const [state, setState] = useState<RadioSimState>(DEFAULT_STATE);
  const [firmware, setFirmware] = useState<SimFirmwareResolution | null>(null);

  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const worker = new Worker(
      new URL("../../workers/edgetxSim.worker.ts", import.meta.url),
    );
    worker.onmessage = (event: MessageEvent<SimWorkerResponse>) => {
      const msg = event.data;
      if (msg.type === "state") setState(msg.state);
      if (msg.type === "frame") {
        // Worker already throttles to ~30 Hz; deliver every transferred frame.
        frameRef.current = msg.frame;
        frameSubscriberRef.current?.(msg.frame);
      }
      if (msg.type === "error") {
        setState({
          phase: "error",
          progress: 0,
          status: "Error",
          error: msg.message,
          keyboardMode: "none",
        });
      }
      if (msg.type === "loadWidgetResult") {
        const pending = pendingLoadRef.current.get(msg.requestId);
        if (!pending) return;
        pendingLoadRef.current.delete(msg.requestId);
        if (msg.ok) {
          pending.resolve();
        } else {
          pending.reject(new Error(msg.error));
        }
      }
    };
    worker.onerror = () => {
      setState({
        phase: "error",
        progress: 0,
        status: "Error",
        error: "Radio sim worker failed. Check the browser console.",
        keyboardMode: "none",
      });
    };
    workerRef.current = worker;
    return worker;
  }, []);

  const init = useCallback(
    async (widget?: RadioSimInitOptions) => {
      const worker = ensureWorker();
      const edgeTxVersion = widget?.edgeTxVersion ?? DEFAULT_EDGE_TX_VERSION;
      setState({
        phase: "loading-wasm",
        progress: 0,
        status: "Resolving firmware…",
        error: null,
        keyboardMode: "none",
      });

      try {
        const manifest = await fetchSimManifest();
        const radioId = widget?.radioId ?? "tx15";
        const resolved = resolveSimFirmware(manifest, edgeTxVersion, radioId);
        const wasmUrl = await resolveReachableWasmUrl(resolved, manifest);
        setFirmware(resolved);
        setState({
          phase: "loading-wasm",
          progress: 0,
          status: "Starting…",
          error: null,
          keyboardMode: "none",
        });

        const modelPng = widget?.modelPng
          ? (widget.modelPng.buffer.slice(
              widget.modelPng.byteOffset,
              widget.modelPng.byteOffset + widget.modelPng.byteLength,
            ) as ArrayBuffer)
          : undefined;
        const req: SimWorkerRequest = {
          type: "init",
          wasmUrl,
          radioKey: resolved.radioKey,
          edgeTxVersion: resolved.effectiveVersion,
          source: widget?.source,
          zone: widget?.zone,
          mock: widget?.mock,
          modelPng,
        };
        worker.postMessage(
          req,
          modelPng ? { transfer: [modelPng] } : undefined,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setState({
          phase: "error",
          progress: 0,
          status: "Error",
          error: message,
          keyboardMode: "none",
        });
      }
    },
    [ensureWorker],
  );

  const loadWidget = useCallback(
    (source: string, zone?: WidgetSimulateZone, modelPng?: Uint8Array) => {
      const worker = ensureWorker();
      const requestId = nextLoadRequestIdRef.current++;
      const transferPng = modelPng
        ? (modelPng.buffer.slice(
            modelPng.byteOffset,
            modelPng.byteOffset + modelPng.byteLength,
          ) as ArrayBuffer)
        : undefined;
      const req: SimWorkerRequest = {
        type: "loadWidget",
        source,
        zone,
        requestId,
        modelPng: transferPng,
      };
      return new Promise<void>((resolve, reject) => {
        pendingLoadRef.current.set(requestId, { resolve, reject });
        worker.postMessage(
          req,
          transferPng ? { transfer: [transferPng] } : undefined,
        );
      });
    },
    [ensureWorker],
  );

  const setMock = useCallback(
    (mock: MockTelemetryValues) => {
      const worker = ensureWorker();
      const req: SimWorkerRequest = { type: "setMock", mock };
      worker.postMessage(req);
    },
    [ensureWorker],
  );

  const sendInput = useCallback((msg: SimInputMessage) => {
    const worker = workerRef.current;
    if (!worker) return;
    const req: SimWorkerRequest = { type: "input", msg };
    worker.postMessage(req);
  }, []);

  const pause = useCallback(() => {
    workerRef.current?.postMessage({
      type: "pause",
    } satisfies SimWorkerRequest);
  }, []);

  const resume = useCallback(() => {
    workerRef.current?.postMessage({
      type: "resume",
    } satisfies SimWorkerRequest);
  }, []);

  const enterWidgetFullscreen = useCallback(() => {
    workerRef.current?.postMessage({
      type: "enterWidgetFullscreen",
    } satisfies SimWorkerRequest);
  }, []);

  const subscribeFrames = useCallback((subscriber: FrameSubscriber | null) => {
    frameSubscriberRef.current = subscriber;
    if (subscriber && frameRef.current) {
      subscriber(frameRef.current);
    }
  }, []);

  const dispose = useCallback(() => {
    for (const pending of pendingLoadRef.current.values()) {
      pending.reject(new Error("Simulator disposed"));
    }
    pendingLoadRef.current.clear();
    workerRef.current?.postMessage({
      type: "dispose",
    } satisfies SimWorkerRequest);
    workerRef.current?.terminate();
    workerRef.current = null;
    frameRef.current = null;
    frameSubscriberRef.current = null;
    setFirmware(null);
    setState(DEFAULT_STATE);
  }, []);

  const wasmSizeMb =
    firmware?.size != null
      ? Math.round((firmware.size / 1024 / 1024) * 10) / 10
      : null;

  return {
    state,
    firmware,
    wasmSizeMb,
    keyboardMode: state.keyboardMode,
    init,
    loadWidget,
    setMock,
    sendInput,
    pause,
    resume,
    enterWidgetFullscreen,
    subscribeFrames,
    dispose,
  };
}
