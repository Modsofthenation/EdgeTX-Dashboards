import type { WasmRunner } from "@edgetx/simulator-ui";
import {
  buildTelemetryFrames,
  injectTelemetryFrames,
  BASE_MOCK_TELEMETRY,
} from "./telemetryBridge.js";
import { lcdFrameByteSize } from "./framebuffer.js";
import { planWidgetDeploy, PLACEHOLDER_MODEL_PNG } from "./virtualSd.js";
import type {
  ExtendedSimulatorExports,
  MockTelemetryValues,
  RadioSimState,
  SimFrameData,
  SimInputMessage,
  SimKeyboardMode,
  WidgetSimulateZone,
} from "./types.js";

export type SimRuntimeCallbacks = {
  onState?: (state: RadioSimState) => void;
  onFrame?: (frame: SimFrameData) => void;
  onLog?: (text: string) => void;
};

const DEFAULT_STATE: RadioSimState = {
  phase: "idle",
  progress: 0,
  status: "",
  error: null,
  keyboardMode: "none",
};

export class SimRuntime {
  private runner: WasmRunner | null = null;
  private loopRunning = false;
  private scriptLaunched = false;
  private pendingWidget: { source: string; zone?: WidgetSimulateZone } | null = null;
  private mock: MockTelemetryValues = { ...BASE_MOCK_TELEMETRY };
  private lastTelemetryMs = 0;
  private lastKeyboardPollMs = 0;
  private state: RadioSimState = { ...DEFAULT_STATE };
  private callbacks: SimRuntimeCallbacks;

  constructor(
    private wasmUrl: string,
    private radioKey: string,
    callbacks: SimRuntimeCallbacks = {}
  ) {
    this.callbacks = callbacks;
  }

  private setState(partial: Partial<RadioSimState>): void {
    this.state = { ...this.state, ...partial };
    this.callbacks.onState?.(this.state);
  }

  handleInput(msg: SimInputMessage): void {
    const runner = this.runner;
    const ex = runner?.exports;
    if (!runner || !ex) return;

    switch (msg.type) {
      case "simAnalog": {
        const v = Math.round(Math.max(0, Math.min(4096, msg.value)));
        runner.setAnalog(msg.index, v);
        break;
      }
      case "simSwitch":
        ex.simuSetSwitch(msg.index, msg.state);
        break;
      case "simKey":
        ex.simuSetKey(msg.key, msg.state);
        break;
      case "simTrim":
        ex.simuSetTrim(msg.trim, msg.state);
        break;
      case "simRotary":
        ex.simuRotaryEncoderEvent(msg.steps);
        break;
      case "simChar":
        ex.simuInjectChar(msg.code);
        break;
      case "simTouch":
        ex.simuTouchDown(msg.x, msg.y);
        break;
      case "simTouchUp":
        ex.simuTouchUp();
        break;
    }
  }

  async init(options?: { source?: string; zone?: WidgetSimulateZone }): Promise<void> {
    this.setState({ phase: "loading-wasm", progress: 5, status: "Loading firmware…" });

    try {
      const { WasmRunner } = await import("@edgetx/simulator-ui");
      this.runner = new WasmRunner(
        (text: string) => this.callbacks.onLog?.(text),
        () => {}
      );

      this.setState({ progress: 15, status: "Setting up virtual SD card…" });
      await this.runner.initFs(this.radioKey);

      if (options?.source) {
        this.setState({ progress: 25, status: "Deploying widget…" });
        await this.deployWidget(options.source);
        this.pendingWidget = { source: options.source, zone: options.zone };
        this.scriptLaunched = false;
      }

      this.setState({ progress: 40, status: "Loading WASM…" });
      await this.runner.load(this.wasmUrl);

      this.setState({ phase: "booting", progress: 80, status: "Starting firmware…" });
      const ex = this.getExports();
      ex.simuInit();
      this.runner.setFatfsPaths("/", "/");
      (ex as ExtendedSimulatorExports).simuCreateDefaults?.();
      ex.simuStart(0);

      this.loopRunning = true;
      this.setState({ phase: "running", progress: 100, status: "Running" });
      void this.runLoop();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.setState({ phase: "error", progress: 0, status: "Error", error: message });
      throw err;
    }
  }

  async loadWidget(source: string, zone?: WidgetSimulateZone): Promise<void> {
    this.scriptLaunched = false;
    this.pendingWidget = null;
    await this.deployWidget(source);
    this.pendingWidget = { source, zone };
  }

  setMockTelemetry(mock: MockTelemetryValues): void {
    this.mock = mock;
  }

  async dispose(): Promise<void> {
    this.loopRunning = false;
    this.scriptLaunched = false;
    this.pendingWidget = null;
    if (this.runner) {
      this.runner.stopSim();
      await this.runner.stopFs();
      this.runner = null;
    }
    this.state = { ...DEFAULT_STATE };
    this.callbacks.onState?.(this.state);
  }

  private getExports(): NonNullable<WasmRunner["exports"]> {
    const ex = this.runner?.exports;
    if (!ex) throw new Error("WASM not loaded");
    return ex;
  }

  private async deployWidget(source: string): Promise<void> {
    const runner = this.runner;
    if (!runner) return;

    const plan = planWidgetDeploy(source);
    await runner.fsWriteFile(
      plan.paths.luaPath,
      plan.luaBytes.buffer.slice(
        plan.luaBytes.byteOffset,
        plan.luaBytes.byteOffset + plan.luaBytes.byteLength
      ) as ArrayBuffer
    );
    await runner.fsWriteFile(
      plan.paths.modelPngPath,
      PLACEHOLDER_MODEL_PNG.buffer.slice(
        PLACEHOLDER_MODEL_PNG.byteOffset,
        PLACEHOLDER_MODEL_PNG.byteOffset + PLACEHOLDER_MODEL_PNG.byteLength
      ) as ArrayBuffer
    );
  }

  private launchWidget(source: string, zone?: WidgetSimulateZone): void {
    const ex = this.getExports() as NonNullable<WasmRunner["exports"]> & ExtendedSimulatorExports;
    const plan = planWidgetDeploy(source);
    const allocCStr = (s: string): number => {
      const encoded = new TextEncoder().encode(s);
      const ptr = ex.malloc(encoded.length + 1);
      if (!ptr) throw new Error("malloc failed");
      const view = new Uint8Array(ex.memory.buffer);
      view.set(encoded, ptr);
      view[ptr + encoded.length] = 0;
      return ptr;
    };

    if (zone && ex.simuLoadWidgetByLayout) {
      const namePtr = allocCStr(plan.widgetName);
      const layoutPtr = allocCStr(zone.layout);
      try {
        ex.simuLoadWidgetByLayout(namePtr, layoutPtr, zone.zone);
      } finally {
        ex.free(namePtr);
        ex.free(layoutPtr);
      }
    } else if (ex.simuLoadWidget) {
      const namePtr = allocCStr(plan.widgetName);
      try {
        ex.simuLoadWidget(namePtr);
      } finally {
        ex.free(namePtr);
      }
    } else {
      this.callbacks.onLog?.("Radio sim: firmware missing simuLoadWidget export");
    }
  }

  private maybePollKeyboardMode(now: number): void {
    if (now - this.lastKeyboardPollMs < 200) return;
    this.lastKeyboardPollMs = now;
    const ex = this.runner?.exports;
    if (!ex) return;

    let mode: SimKeyboardMode = "none";
    if (ex.simuIsTextKeyboardActive?.()) {
      mode = "text";
    } else if (ex.simuIsNumberKeyboardActive?.()) {
      mode = "number";
    }
    if (mode !== this.state.keyboardMode) {
      this.setState({ keyboardMode: mode });
    }
  }

  private maybeInjectTelemetry(now: number): void {
    if (now - this.lastTelemetryMs < 100) return;
    this.lastTelemetryMs = now;
    const ex = this.runner?.exports;
    if (!ex?.simuSendTelemetry) return;
    injectTelemetryFrames(ex, buildTelemetryFrames(this.mock));
  }

  private async runLoop(): Promise<void> {
    while (this.loopRunning && this.runner) {
      const runner = this.runner;
      const ex = runner.exports;
      if (!ex) break;

      const ready = await runner.waitForLcdFrame(100);
      if (!this.loopRunning || !runner.exports) break;
      if (!ready) continue;

      const now = Date.now();
      this.maybeInjectTelemetry(now);
      this.maybePollKeyboardMode(now);

      const depth = ex.simuLcdGetDepth();
      const w = ex.simuLcdGetWidth();
      const h = ex.simuLcdGetHeight();
      const size = lcdFrameByteSize(w, h, depth);
      const frame = runner.copyLcd(size);
      if (!frame) continue;

      ex.simuLcdFlushed();

      if (!this.scriptLaunched && this.pendingWidget) {
        this.scriptLaunched = true;
        this.launchWidget(this.pendingWidget.source, this.pendingWidget.zone);
      }

      const buf = frame.buffer.slice(
        frame.byteOffset,
        frame.byteOffset + frame.byteLength
      );
      this.callbacks.onFrame?.({ buffer: buf, width: w, height: h, depth });
    }
  }
}
