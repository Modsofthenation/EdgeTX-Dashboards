/** Mock telemetry shape shared with apps/web mockTelemetry.ts */
export interface MockTelemetryValues {
  RQLY: number;
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

export interface RadioSimState {
  phase: RadioSimPhase;
  progress: number;
  status: string;
  error: string | null;
}

export interface WidgetSimulateZone {
  layout: string;
  zone: number;
}

/** Messages from main thread → sim worker */
export type SimWorkerRequest =
  | {
      type: "init";
      wasmUrl: string;
      radioKey: string;
      source?: string;
      zone?: WidgetSimulateZone;
    }
  | { type: "loadWidget"; source: string; zone?: WidgetSimulateZone }
  | { type: "setMock"; mock: MockTelemetryValues }
  | { type: "dispose" };

/** Messages from sim worker → main thread */
export type SimWorkerResponse =
  | { type: "state"; state: RadioSimState }
  | { type: "frame"; frame: SimFrameData }
  | { type: "log"; text: string }
  | { type: "error"; message: string };

export interface ExtendedSimulatorExports {
  simuLoadWidget?: (namePtr: number) => void;
  simuLoadWidgetByLayout?: (namePtr: number, layoutPtr: number, zoneIndex: number) => void;
  simuCreateDefaults?: () => void;
}
