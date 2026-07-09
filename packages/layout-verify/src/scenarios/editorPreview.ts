import { BASE_MOCK } from "../mockTelemetry.js";
import type { LayoutScenario } from "../types.js";

/** Mock telemetry + widget state tuned to match typical WASM sim preview output. */
export const EDITOR_PREVIEW_SCENARIO: LayoutScenario = {
  id: "editor-preview",
  mock: {
    ...BASE_MOCK,
    RQLY: 98,
    TQLY: 95,
    "1RSS": 0,
    "2RSS": 0,
    RxBt: 12.0,
    Curr: 12.4,
    Capa: 850,
    "Bat%": 100,
    Alt: 45,
    GSpd: 0,
    Sats: 14,
    FM: "Arm",
    Ptch: 0,
    Roll: 0,
  },
  armed: true,
  flightSecs: 3,
};

export const PREVIEW_SCENARIOS: Record<string, LayoutScenario> = {
  "editor-preview": EDITOR_PREVIEW_SCENARIO,
  disarmed: {
    id: "disarmed",
    mock: {
      ...EDITOR_PREVIEW_SCENARIO.mock,
      FM: "Stab",
      RQLY: 92,
      RxBt: 16.2,
      "Bat%": 78,
    },
    armed: false,
    flightSecs: 0,
  },
  "low-battery": {
    id: "low-battery",
    mock: {
      ...EDITOR_PREVIEW_SCENARIO.mock,
      RxBt: 10.8,
      "Bat%": 12,
      Curr: 28,
      Capa: 2100,
    },
    armed: true,
    flightSecs: 180,
  },
  "weak-link": {
    id: "weak-link",
    mock: {
      ...EDITOR_PREVIEW_SCENARIO.mock,
      RQLY: 18,
      TQLY: 22,
      "1RSS": -95,
      "2RSS": -98,
    },
    armed: true,
    flightSecs: 45,
  },
  "gps-lost": {
    id: "gps-lost",
    mock: {
      ...EDITOR_PREVIEW_SCENARIO.mock,
      Sats: 0,
      GSpd: 0,
      Alt: 0,
    },
    armed: true,
    flightSecs: 60,
  },
};

export function getPreviewScenario(id: string): LayoutScenario {
  return PREVIEW_SCENARIOS[id] ?? EDITOR_PREVIEW_SCENARIO;
}
