export interface MockTelemetry {
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

export const BASE_MOCK: MockTelemetry = {
  RQLY: 92,
  "1RSS": -67,
  "2RSS": -70,
  RxBt: 16.2,
  Curr: 12.4,
  Capa: 850,
  "Bat%": 78,
  Alt: 125,
  GSpd: 45,
  Hdg: 182,
  Sats: 14,
  FM: "Stab",
  RFMD: "250Hz",
  TPWR: 250,
  RPM: 3200,
  HSpd: 1850,
  EscT: 42,
  MotT: 58,
  AdjF: "Pitch",
  AdjV: 12,
  Ptch: 0.05,
  Roll: -0.02,
  Yaw: 1.2,
};

/** Slightly vary mock values each tick for a live feel. */
export function tickMock(base: MockTelemetry, tick: number): MockTelemetry {
  const wave = Math.sin(tick / 20);
  return {
    ...base,
    RQLY: Math.round(clamp(base.RQLY + wave * 4, 60, 100)),
    "1RSS": Math.round(base["1RSS"] + wave * 2),
    RxBt: round1(base.RxBt + wave * 0.05),
    Curr: round1(base.Curr + wave * 1.2),
    Alt: Math.round(base.Alt + wave * 3),
    GSpd: Math.round(base.GSpd + wave * 5),
    Sats: base.Sats,
    RPM: Math.round(base.RPM + wave * 80),
    HSpd: Math.round(base.HSpd + wave * 40),
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

const SENSOR_ALIASES: Record<string, keyof MockTelemetry> = {
  TRSS: "1RSS",
  RSSI: "1RSS",
};

export function getMockForSensor(name: string, mock: MockTelemetry): string | number {
  const alias = SENSOR_ALIASES[name];
  if (alias) return mock[alias];
  const key = name as keyof MockTelemetry;
  if (key in mock) {
    return mock[key];
  }
  return 0;
}
