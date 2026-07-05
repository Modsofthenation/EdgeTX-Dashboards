"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  MockTelemetryValues,
  RadioSimState,
  SimFrameData,
  SimWorkerRequest,
  SimWorkerResponse,
  WidgetSimulateZone,
} from "@widget-gen/sim-preview";

const DEFAULT_STATE: RadioSimState = {
  phase: "idle",
  progress: 0,
  status: "",
  error: null,
};

export function useRadioSim() {
  const workerRef = useRef<Worker | null>(null);
  const [state, setState] = useState<RadioSimState>(DEFAULT_STATE);
  const [frame, setFrame] = useState<SimFrameData | null>(null);
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
      if (msg.type === "frame") setFrame(msg.frame);
      if (msg.type === "error") {
        setState({ phase: "error", progress: 0, status: "Error", error: msg.message });
      }
    };
    worker.onerror = () => {
      setState({
        phase: "error",
        progress: 0,
        status: "Error",
        error: "Radio sim worker failed. Check the browser console.",
      });
    };
    workerRef.current = worker;
    return worker;
  }, []);

  const init = useCallback(
    (widget?: { source: string; zone?: WidgetSimulateZone }) => {
      const worker = ensureWorker();
      setState({ phase: "loading-wasm", progress: 0, status: "Starting…", error: null });
      const req: SimWorkerRequest = {
        type: "init",
        wasmUrl: "/sim/edgetx-tx15-simulator.wasm",
        radioKey: "tx15",
        source: widget?.source,
        zone: widget?.zone,
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

  const dispose = useCallback(() => {
    workerRef.current?.postMessage({ type: "dispose" } satisfies SimWorkerRequest);
    workerRef.current?.terminate();
    workerRef.current = null;
    setFrame(null);
    setState(DEFAULT_STATE);
  }, []);

  return { state, frame, wasmSizeMb, init, loadWidget, setMock, dispose };
}
