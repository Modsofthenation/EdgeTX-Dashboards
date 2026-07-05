"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  MockTelemetryValues,
  RadioSimState,
  SimFrameData,
  SimInputMessage,
  SimWorkerRequest,
  SimWorkerResponse,
  WidgetSimulateZone,
} from "@widget-gen/sim-preview";

const DEFAULT_STATE: RadioSimState = {
  phase: "idle",
  progress: 0,
  status: "",
  error: null,
  keyboardMode: "none",
};

const FRAME_MIN_INTERVAL_MS = 33;

export type FrameSubscriber = (frame: SimFrameData) => void;

export function useRadioSim() {
  const workerRef = useRef<Worker | null>(null);
  const frameRef = useRef<SimFrameData | null>(null);
  const frameSubscriberRef = useRef<FrameSubscriber | null>(null);
  const lastFrameCommitRef = useRef(0);
  const [state, setState] = useState<RadioSimState>(DEFAULT_STATE);
  const [wasmSizeMb, setWasmSizeMb] = useState<number | null>(null);

  useEffect(() => {
    fetch("/sim/manifest.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((manifest) => {
        const size = manifest?.radios?.tx15?.size;
        if (typeof size === "number") setWasmSizeMb(Math.round((size / 1024 / 1024) * 10) / 10);
      })
      .catch(() => {});
  }, []);

  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const worker = new Worker(new URL("../../workers/edgetxSim.worker.ts", import.meta.url));
    worker.onmessage = (event: MessageEvent<SimWorkerResponse>) => {
      const msg = event.data;
      if (msg.type === "state") setState(msg.state);
      if (msg.type === "frame") {
        frameRef.current = msg.frame;
        const subscriber = frameSubscriberRef.current;
        if (!subscriber) return;
        const now = performance.now();
        if (now - lastFrameCommitRef.current < FRAME_MIN_INTERVAL_MS) return;
        lastFrameCommitRef.current = now;
        subscriber(msg.frame);
      }
      if (msg.type === "error") {
        setState({ phase: "error", progress: 0, status: "Error", error: msg.message, keyboardMode: "none" });
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
    (widget?: { source: string; zone?: WidgetSimulateZone; mock?: MockTelemetryValues }) => {
      const worker = ensureWorker();
      setState({ phase: "loading-wasm", progress: 0, status: "Starting…", error: null, keyboardMode: "none" });
      const req: SimWorkerRequest = {
        type: "init",
        wasmUrl: "/sim/edgetx-tx15-simulator.wasm",
        radioKey: "tx15",
        source: widget?.source,
        zone: widget?.zone,
        mock: widget?.mock,
      };
      worker.postMessage(req);
    },
    [ensureWorker]
  );

  const loadWidget = useCallback(
    (source: string, zone?: WidgetSimulateZone) => {
      const worker = ensureWorker();
      const req: SimWorkerRequest = { type: "loadWidget", source, zone };
      worker.postMessage(req);
    },
    [ensureWorker]
  );

  const setMock = useCallback(
    (mock: MockTelemetryValues) => {
      const worker = ensureWorker();
      const req: SimWorkerRequest = { type: "setMock", mock };
      worker.postMessage(req);
    },
    [ensureWorker]
  );

  const sendInput = useCallback((msg: SimInputMessage) => {
    const worker = workerRef.current;
    if (!worker) return;
    const req: SimWorkerRequest = { type: "input", msg };
    worker.postMessage(req);
  }, []);

  const pause = useCallback(() => {
    workerRef.current?.postMessage({ type: "pause" } satisfies SimWorkerRequest);
    frameSubscriberRef.current = null;
    lastFrameCommitRef.current = 0;
  }, []);

  const resume = useCallback(() => {
    workerRef.current?.postMessage({ type: "resume" } satisfies SimWorkerRequest);
  }, []);

  const subscribeFrames = useCallback((subscriber: FrameSubscriber | null) => {
    frameSubscriberRef.current = subscriber;
    lastFrameCommitRef.current = 0;
    if (subscriber && frameRef.current) {
      subscriber(frameRef.current);
    }
  }, []);

  const dispose = useCallback(() => {
    workerRef.current?.postMessage({ type: "dispose" } satisfies SimWorkerRequest);
    workerRef.current?.terminate();
    workerRef.current = null;
    frameRef.current = null;
    frameSubscriberRef.current = null;
    lastFrameCommitRef.current = 0;
    setState(DEFAULT_STATE);
  }, []);

  return {
    state,
    wasmSizeMb,
    keyboardMode: state.keyboardMode,
    init,
    loadWidget,
    setMock,
    sendInput,
    pause,
    resume,
    subscribeFrames,
    dispose,
  };
}
