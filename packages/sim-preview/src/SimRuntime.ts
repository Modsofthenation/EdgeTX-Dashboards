import type { WasmRunner } from "@edgetx/simulator-ui";
import {
  buildTelemetryFrames,
  injectTelemetryFrames,
  BASE_MOCK_TELEMETRY,
} from "./telemetryBridge.ts";
import { lcdFrameByteSize } from "./framebuffer.ts";
import {
  deploySimModel,
  SIM_MODEL1_PATH,
  type SimWidgetLayoutPlan,
} from "./simModel.ts";
import { planWidgetDeploy, PLACEHOLDER_MODEL_PNG } from "./virtualSd.ts";
import {
  buildHotReloadGenSource,
  buildHotReloadShimSource,
  hotReloadPaths,
} from "./hotReloadShim.ts";
import type {
  ExtendedSimulatorExports,
  MockTelemetryValues,
  RadioSimState,
  SimFrameData,
  SimInputMessage,
  SimKeyboardMode,
  WidgetSimulateZone,
} from "./types.ts";

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

/** Frames to stream CRSF before first widget load (~200ms at 60 Hz). */
export const WIDGET_LAUNCH_DELAY_FRAMES = 12;

const FULLSCREEN_WAIT_FRAMES = 30;
const FULLSCREEN_RETRY_WAIT_FRAMES = 20;
const FULLSCREEN_TAP_GAP_FRAMES = 4;
const FULLSCREEN_MAX_ATTEMPTS = 4;

type FullscreenTapGesture = {
  x: number;
  y: number;
  /** 0=wait, 1=down, 2=up+gap, 3=down, 4=up */
  step: number;
  counter: number;
  attempt: number;
};

export class SimRuntime {
  private runner: WasmRunner | null = null;
  private loopRunning = false;
  private scriptLaunched = false;
  private widgetLaunchDelayFrames = 0;
  private pendingWidget: { source: string; zone?: WidgetSimulateZone } | null =
    null;
  private lastLoadedZone: WidgetSimulateZone | null = null;
  private modelBackup: Map<string, string> | null = null;
  private fullscreenTap: FullscreenTapGesture | null = null;
  private mock: MockTelemetryValues = { ...BASE_MOCK_TELEMETRY };
  private lastTelemetryMs = 0;
  private lastKeyboardPollMs = 0;
  private state: RadioSimState = { ...DEFAULT_STATE };
  private callbacks: SimRuntimeCallbacks;
  private paused = false;
  private edgeTxVersion = "2.11.0";
  /** Coalesces rapid hot-reloads (e.g. editor drag) into one FS write at a time. */
  private loadWidgetChain: Promise<void> = Promise.resolve();
  private loadWidgetPending: {
    source: string;
    zone?: WidgetSimulateZone;
    modelPng?: Uint8Array;
  } | null = null;
  private customModelPng: Uint8Array | null = null;
  /** Hot-reload: stable shim main.lua + body.lua; bump gen on each deploy. */
  private hotReloadGen = 0;
  private hotReloadFolder: string | null = null;
  /** Skip redundant FS writes when content is unchanged. */
  private deployCache: {
    bodySource: string | null;
    folderName: string | null;
    modelKey: string | null;
    pngFingerprint: string | null;
  } = {
    bodySource: null,
    folderName: null,
    modelKey: null,
    pngFingerprint: null,
  };

  private wasmUrl: string;
  private radioKey: string;

  constructor(
    wasmUrl: string,
    radioKey: string,
    callbacks: SimRuntimeCallbacks = {},
  ) {
    this.wasmUrl = wasmUrl;
    this.radioKey = radioKey;
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

  async init(options?: {
    source?: string;
    zone?: WidgetSimulateZone;
    mock?: MockTelemetryValues;
    edgeTxVersion?: string;
    modelPng?: Uint8Array;
  }): Promise<void> {
    if (options?.edgeTxVersion) {
      this.edgeTxVersion = options.edgeTxVersion;
    }
    if (options?.modelPng) {
      this.customModelPng = options.modelPng;
    }
    this.setState({
      phase: "loading-wasm",
      progress: 5,
      status: "Loading firmware…",
    });

    try {
      if (options?.mock) {
        this.mock = options.mock;
      }
      const { WasmRunner } = await import("@edgetx/simulator-ui");
      this.runner = new WasmRunner(
        (text: string) => this.callbacks.onLog?.(text),
        () => {},
      );

      this.setState({ progress: 15, status: "Setting up virtual SD card…" });
      await this.runner.initFs(this.radioKey);

      if (options?.source) {
        this.setState({ progress: 25, status: "Deploying widget…" });
        await this.deployWidget(options.source);
        this.pendingWidget = { source: options.source, zone: options.zone };
        this.scriptLaunched = false;
        this.fullscreenTap = null;
        this.widgetLaunchDelayFrames = WIDGET_LAUNCH_DELAY_FRAMES;
      }

      this.setState({ progress: 40, status: "Loading WASM…" });
      await this.runner.load(this.wasmUrl);

      this.setState({
        phase: "booting",
        progress: 80,
        status: "Starting firmware…",
      });
      const ex = this.getExports();
      ex.simuInit();
      this.runner.setFatfsPaths("/", "/");
      (ex as ExtendedSimulatorExports).simuCreateDefaults?.();
      await deploySimModel(
        this.runner,
        this.layoutPlanFrom(options?.source, options?.zone),
        this.edgeTxVersion,
      );
      ex.simuStart(0);

      this.loopRunning = true;
      this.setState({ phase: "running", progress: 100, status: "Running" });
      void this.runLoop();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.setState({
        phase: "error",
        progress: 0,
        status: "Error",
        error: message,
      });
      throw err;
    }
  }

  async loadWidget(
    source: string,
    zone?: WidgetSimulateZone,
    modelPng?: Uint8Array,
  ): Promise<void> {
    this.loadWidgetPending = { source, zone, modelPng };
    // Recover the queue after failures so one rejected reload never bricks future updates.
    this.loadWidgetChain = this.loadWidgetChain
      .catch(() => undefined)
      .then(() => this.flushPendingLoadWidget());
    await this.loadWidgetChain;
  }

  private async flushPendingLoadWidget(): Promise<void> {
    while (this.loadWidgetPending) {
      const pending = this.loadWidgetPending;
      this.loadWidgetPending = null;
      await this.applyLoadWidget(
        pending.source,
        pending.zone,
        pending.modelPng,
      );
    }
  }

  private async applyLoadWidget(
    source: string,
    zone?: WidgetSimulateZone,
    modelPng?: Uint8Array,
  ): Promise<void> {
    this.fullscreenTap = null;
    if (modelPng) {
      this.customModelPng = modelPng;
    }
    const runner = this.runner;
    // Runtime not ready yet: store desired widget and let init/loop pick it up.
    if (!runner) {
      this.pendingWidget = { source, zone };
      this.scriptLaunched = false;
      this.widgetLaunchDelayFrames = WIDGET_LAUNCH_DELAY_FRAMES;
      return;
    }

    const deploy = await this.deployWidget(source);
    const layoutPlan = this.layoutPlanFrom(source, zone);
    const modelKey = layoutPlan
      ? `${layoutPlan.widgetName}|${layoutPlan.layoutId}|${layoutPlan.zoneIndex}|${this.edgeTxVersion}`
      : null;
    if (modelKey !== this.deployCache.modelKey) {
      await deploySimModel(runner, layoutPlan, this.edgeTxVersion);
      this.deployCache.modelKey = modelKey;
    }
    this.pendingWidget = { source, zone };

    const zoneChanged =
      zone != null &&
      (this.lastLoadedZone == null ||
        this.lastLoadedZone.layout !== zone.layout ||
        this.lastLoadedZone.zone !== zone.zone);
    const needsRelaunch = deploy.needsRelaunch || zoneChanged;

    // Hot path: shim is already registered — body.lua + gen.lua rewrite is
    // enough; refresh() loadScripts the new body on the next frame.
    if (runner && this.loopRunning && this.scriptLaunched && !needsRelaunch) {
      this.callbacks.onLog?.(
        `Radio sim: hot-reloaded body (gen ${this.hotReloadGen})`,
      );
      return;
    }

    // Cold / folder-rename path: (re)launch the shim widget factory.
    if (runner && this.loopRunning) {
      this.scriptLaunched = true;
      this.widgetLaunchDelayFrames = 0;
      this.launchWidget(source, zone);
      return;
    }

    this.scriptLaunched = false;
    this.widgetLaunchDelayFrames = WIDGET_LAUNCH_DELAY_FRAMES;
  }

  setMockTelemetry(mock: MockTelemetryValues): void {
    this.mock = mock;
  }

  /** Manual fallback: replay widget fullscreen double-tap on the 480×320 LCD. */
  requestEnterWidgetFullscreen(): void {
    const zone = this.lastLoadedZone ?? this.pendingWidget?.zone;
    if (!zone?.enterFullscreen) return;
    this.beginFullscreenTap(zone);
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  async dispose(): Promise<void> {
    this.paused = false;
    this.loopRunning = false;
    this.scriptLaunched = false;
    this.pendingWidget = null;
    this.lastLoadedZone = null;
    this.fullscreenTap = null;
    this.loadWidgetPending = null;
    this.loadWidgetChain = Promise.resolve();
    this.hotReloadGen = 0;
    this.hotReloadFolder = null;
    this.deployCache = {
      bodySource: null,
      folderName: null,
      modelKey: null,
      pngFingerprint: null,
    };
    if (this.runner) {
      await this.restoreModels();
      this.runner.stopSim();
      await this.runner.stopFs();
      this.runner = null;
    }
    this.modelBackup = null;
    this.state = { ...DEFAULT_STATE };
    this.callbacks.onState?.(this.state);
  }

  private layoutPlanFrom(
    source?: string,
    zone?: WidgetSimulateZone,
  ): SimWidgetLayoutPlan | undefined {
    if (!source || !zone) return undefined;
    const plan = planWidgetDeploy(source);
    return {
      widgetName: plan.widgetName,
      layoutId: zone.layout,
      zoneIndex: zone.zone,
    };
  }

  private getExports(): NonNullable<WasmRunner["exports"]> {
    const ex = this.runner?.exports;
    if (!ex) throw new Error("WASM not loaded");
    return ex;
  }

  private async deployWidget(
    source: string,
  ): Promise<{ needsRelaunch: boolean; folderName: string }> {
    const runner = this.runner;
    if (!runner) return { needsRelaunch: true, folderName: "Widget" };

    const plan = planWidgetDeploy(source);
    const paths = hotReloadPaths(plan.folderName);
    const folderChanged = this.hotReloadFolder !== plan.folderName;
    const needsRelaunch = folderChanged || !this.scriptLaunched;

    const encode = (text: string) => {
      const bytes = new TextEncoder().encode(text);
      return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer;
    };

    const bodyChanged = this.deployCache.bodySource !== source;
    const folderCacheMiss = this.deployCache.folderName !== plan.folderName;

    // Write first, then commit instance/cache state so a rejected write cannot
    // leave hotReloadFolder / gen claiming a deploy that never landed.
    if (bodyChanged) {
      const nextGen = this.hotReloadGen + 1;
      await runner.fsWriteFile(paths.bodyPath, encode(source));
      await runner.fsWriteFile(
        paths.genPath,
        encode(buildHotReloadGenSource(nextGen)),
      );
      this.hotReloadGen = nextGen;
      this.deployCache.bodySource = source;
    }

    // Shim main.lua only needs writing when the factory is (re)registered.
    if (needsRelaunch || folderCacheMiss) {
      await runner.fsWriteFile(
        paths.shimPath,
        encode(buildHotReloadShimSource(plan.folderName)),
      );
      this.deployCache.folderName = plan.folderName;
    }

    this.hotReloadFolder = plan.folderName;

    const png = this.customModelPng ?? PLACEHOLDER_MODEL_PNG;
    const pngFingerprint = `${png.byteLength}:${png[0] ?? 0}:${png[png.length >> 1] ?? 0}:${png[png.length - 1] ?? 0}`;
    if (this.deployCache.pngFingerprint !== pngFingerprint) {
      const pngBuf = png.buffer.slice(
        png.byteOffset,
        png.byteOffset + png.byteLength,
      ) as ArrayBuffer;
      await runner.fsWriteFile(plan.paths.modelPngPath, pngBuf);
      // Mirror for custom BG_IMG dashboards (`/IMAGES/dashbg.png`).
      await runner.fsWriteFile("/IMAGES/dashbg.png", pngBuf.slice(0));
      this.deployCache.pngFingerprint = pngFingerprint;
    }

    return { needsRelaunch, folderName: plan.folderName };
  }

  private async backupModels(): Promise<void> {
    const runner = this.runner;
    if (!runner?.hasFsWorker || this.modelBackup) return;

    try {
      const backup = new Map<string, string>();
      const listed = await runner.fsListFiles("/MODELS");
      for (const entry of listed) {
        if (!entry.endsWith(".yml")) continue;
        const path = entry.startsWith("/") ? entry : `/MODELS/${entry}`;
        const text = await runner.fsReadTextFile(path);
        if (text != null) backup.set(path, text);
      }
      if (!backup.has(SIM_MODEL1_PATH)) {
        const text = await runner.fsReadTextFile(SIM_MODEL1_PATH);
        if (text != null) backup.set(SIM_MODEL1_PATH, text);
      }
      this.modelBackup = backup.size > 0 ? backup : null;
    } catch {
      this.modelBackup = null;
    }
  }

  private async restoreModels(): Promise<void> {
    if (!this.modelBackup || !this.runner) return;
    for (const [path, text] of this.modelBackup) {
      await this.runner.fsWriteFile(
        path,
        new TextEncoder().encode(text).buffer as ArrayBuffer,
      );
    }
    this.modelBackup = null;
  }

  private fullscreenTapCoords(zone: WidgetSimulateZone): {
    x: number;
    y: number;
  } {
    if (zone.fullscreenTapX != null && zone.fullscreenTapY != null) {
      return { x: zone.fullscreenTapX, y: zone.fullscreenTapY };
    }
    const x = Math.floor((zone.zoneX ?? 0) + (zone.zoneW ?? 480) / 2);
    const y = Math.floor((zone.zoneY ?? 0) + (zone.zoneH ?? 320) / 2);
    return { x, y };
  }

  private beginFullscreenTap(zone: WidgetSimulateZone): void {
    const { x, y } = this.fullscreenTapCoords(zone);
    this.fullscreenTap = {
      x,
      y,
      step: 0,
      counter: FULLSCREEN_WAIT_FRAMES,
      attempt: 0,
    };
  }

  private launchWidget(source: string, zone?: WidgetSimulateZone): void {
    const ex = this.getExports() as NonNullable<WasmRunner["exports"]> &
      ExtendedSimulatorExports;
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
      this.callbacks.onLog?.(
        "Radio sim: firmware missing simuLoadWidget export",
      );
    }

    if (zone?.enterFullscreen) {
      this.lastLoadedZone = zone;
      this.beginFullscreenTap(zone);
    } else {
      this.lastLoadedZone = zone ?? null;
    }
  }

  private finishFullscreenTap(ex: ExtendedSimulatorExports): void {
    ex.simuTouchUp?.();
    const w = ex.simuLcdGetWidth?.() ?? 0;
    const h = ex.simuLcdGetHeight?.() ?? 0;
    this.callbacks.onLog?.(
      `Radio sim: widget fullscreen tap done · LCD ${w}×${h}${w === 480 && h === 320 ? " (full)" : ""}`,
    );
    this.fullscreenTap = null;
  }

  private advanceFullscreenTap(ex: ExtendedSimulatorExports): void {
    const gesture = this.fullscreenTap;
    if (!gesture) return;
    if (
      typeof ex.simuTouchDown !== "function" ||
      typeof ex.simuTouchUp !== "function"
    ) {
      this.fullscreenTap = null;
      return;
    }

    switch (gesture.step) {
      case 0:
        gesture.counter -= 1;
        if (gesture.counter <= 0) gesture.step = 1;
        break;
      case 1:
        ex.simuTouchDown(gesture.x, gesture.y);
        gesture.step = 2;
        break;
      case 2:
        ex.simuTouchUp();
        gesture.step = 3;
        gesture.counter = FULLSCREEN_TAP_GAP_FRAMES;
        break;
      case 3:
        gesture.counter -= 1;
        if (gesture.counter <= 0) gesture.step = 4;
        break;
      case 4:
        ex.simuTouchDown(gesture.x, gesture.y);
        gesture.step = 5;
        break;
      default:
        if (gesture.attempt + 1 < FULLSCREEN_MAX_ATTEMPTS) {
          gesture.attempt += 1;
          gesture.step = 0;
          gesture.counter = FULLSCREEN_RETRY_WAIT_FRAMES;
          ex.simuTouchUp();
          this.callbacks.onLog?.(
            `Radio sim: retrying widget fullscreen double-tap (${gesture.attempt + 1}/${FULLSCREEN_MAX_ATTEMPTS})`,
          );
        } else {
          this.finishFullscreenTap(ex);
        }
        break;
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
    const frames = buildTelemetryFrames(this.mock);
    injectTelemetryFrames(ex, frames);
    if (this.widgetLaunchDelayFrames > 0) {
      injectTelemetryFrames(ex, frames);
      injectTelemetryFrames(ex, frames);
    }
  }

  private async runLoop(): Promise<void> {
    while (this.loopRunning && this.runner) {
      if (this.paused) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }

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

      if (this.pendingWidget && !this.scriptLaunched) {
        if (this.widgetLaunchDelayFrames > 0) {
          this.widgetLaunchDelayFrames -= 1;
        } else {
          await this.backupModels();
          this.scriptLaunched = true;
          this.launchWidget(this.pendingWidget.source, this.pendingWidget.zone);
        }
      }

      this.advanceFullscreenTap(ex as ExtendedSimulatorExports);

      const buf =
        frame.byteOffset === 0 && frame.byteLength === frame.buffer.byteLength
          ? (frame.buffer as ArrayBuffer)
          : (frame.buffer.slice(
              frame.byteOffset,
              frame.byteOffset + frame.byteLength,
            ) as ArrayBuffer);
      this.callbacks.onFrame?.({ buffer: buf, width: w, height: h, depth });
    }
  }
}
