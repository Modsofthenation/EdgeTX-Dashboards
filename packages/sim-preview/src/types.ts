/** Mock telemetry shape shared with apps/web mockTelemetry.ts */
export interface MockTelemetryValues {
  RQLY: number;
  TQLY: number;
  "1RSS": number;
  "2RSS": number;
  RxBt: number;
  Curr: number;
  Capa: number;
  "Bat%": number;
  Alt: number;
  GSpd: number;
  Hdg: number;
  Sats: number;
  FM: string;
  RFMD: string;
  TPWR: number;
  RPM: number;
  HSpd: number;
  EscT: number;
  MotT: number;
  AdjF: string;
  AdjV: number;
  Ptch: number;
  Roll: number;
  Yaw: number;
}

export interface SimFrameData {
  buffer: ArrayBuffer;
  width: number;
  height: number;
  depth: number;
}

export type RadioSimPhase =
  | "idle"
  | "loading-wasm"
  | "booting"
  | "running"
  | "error";

export type SimKeyboardMode = "none" | "text" | "number";

export interface RadioSimState {
  phase: RadioSimPhase;
  progress: number;
  status: string;
  error: string | null;
  keyboardMode: SimKeyboardMode;
}

export interface WidgetSimulateZone {
  layout: string;
  zone: number;
  /** When true, double-tap the zone after load to enter widget fullscreen. */
  enterFullscreen?: boolean;
  zoneX?: number;
  zoneY?: number;
  zoneW?: number;
  zoneH?: number;
  /** Full-framebuffer touch X for fullscreen double-tap (480×320 coords). */
  fullscreenTapX?: number;
  /** Full-framebuffer touch Y for fullscreen double-tap (480×320 coords). */
  fullscreenTapY?: number;
}

/** Input messages mirroring EdgeTX Dev Kit simulatorHost.handleInput */
export type SimInputMessage =
  | { type: "simAnalog"; index: number; value: number }
  | { type: "simSwitch"; index: number; state: number }
  | { type: "simKey"; key: number; state: number }
  | { type: "simTrim"; trim: number; state: number }
  | { type: "simRotary"; steps: number }
  | { type: "simChar"; code: number }
  | { type: "simTouch"; x: number; y: number }
  | { type: "simTouchUp" };

/** Messages from main thread → sim worker */
export type SimWorkerRequest =
  | {
      type: "init";
      wasmUrl: string;
      radioKey: string;
      edgeTxVersion?: string;
      source?: string;
      zone?: WidgetSimulateZone;
      mock?: MockTelemetryValues;
    }
  | { type: "loadWidget"; source: string; zone?: WidgetSimulateZone; requestId: number }
  | { type: "setMock"; mock: MockTelemetryValues }
  | { type: "input"; msg: SimInputMessage }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "enterWidgetFullscreen" }
  | { type: "dispose" };

/** Messages from sim worker → main thread */
export type SimWorkerResponse =
  | { type: "state"; state: RadioSimState }
  | { type: "frame"; frame: SimFrameData }
  | { type: "log"; text: string }
  | { type: "error"; message: string }
  | { type: "loadWidgetResult"; requestId: number; ok: true }
  | { type: "loadWidgetResult"; requestId: number; ok: false; error: string };

export interface ExtendedSimulatorExports {
  simuLoadWidget?: (namePtr: number) => void;
  simuLoadWidgetByLayout?: (namePtr: number, layoutPtr: number, zoneIndex: number) => void;
  simuTouchDown?: (x: number, y: number) => void;
  simuTouchUp?: () => void;
  simuCreateDefaults?: () => void;
  simuLcdGetWidth?: () => number;
  simuLcdGetHeight?: () => number;
}
