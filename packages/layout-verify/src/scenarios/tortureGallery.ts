import { BASE_MOCK, type MockTelemetry } from "../mockTelemetry.ts";
import type { LayoutScenario } from "../types.ts";

const BOOL_OPTIONS = ["ShowTimer", "ShowAtt", "ShowCapa", "ShowLink", "ShowGPS"] as const;

function allOptions(value: 0 | 1): Record<string, 0 | 1> {
  const out: Record<string, 0 | 1> = {};
  for (const name of BOOL_OPTIONS) out[name] = value;
  return out;
}

function withMock(overrides: Partial<MockTelemetry>): MockTelemetry {
  return { ...BASE_MOCK, ...overrides };
}

export const DEFAULT_LAYOUT_SCENARIO: LayoutScenario = {
  id: "default",
  mock: BASE_MOCK,
};

export const TORTURE_SCENARIOS: LayoutScenario[] = [
  DEFAULT_LAYOUT_SCENARIO,
  {
    id: "all-bool-on",
    mock: BASE_MOCK,
    options: allOptions(1),
  },
  {
    id: "all-bool-off",
    mock: BASE_MOCK,
    options: allOptions(0),
  },
  {
    id: "armed",
    mock: withMock({ FM: "Arm" }),
    options: allOptions(1),
    armed: true,
  },
  {
    id: "disarmed",
    mock: withMock({ FM: "DISARM" }),
    options: allOptions(1),
    armed: false,
  },
  {
    id: "long-strings",
    mock: withMock({
      FM: "ACRO ARMED MODE",
      "Bat%": 100,
    }),
    options: allOptions(1),
    armed: true,
  },
  {
    id: "tight-mainH",
    mock: withMock({
      Alt: 999,
      "Bat%": 5,
      RxBt: 3.1,
    }),
    options: { ShowTimer: 1, ShowAtt: 1, ShowCapa: 1, ShowLink: 1, ShowGPS: 0 },
  },
  {
    id: "extreme-telemetry",
    mock: withMock({
      Alt: 0,
      "Bat%": 0,
      RxBt: 0,
      Curr: 0,
      Capa: 0,
      RQLY: 0,
      GSpd: 0,
      Sats: 0,
      Hdg: 0,
      Ptch: 0,
      Roll: 0,
    }),
    options: allOptions(1),
  },
];
