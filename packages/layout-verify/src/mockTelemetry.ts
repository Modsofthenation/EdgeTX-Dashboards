export interface MockTelemetry {
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

export const BASE_MOCK: MockTelemetry = {
  RQLY: 92,
  TQLY: 88,
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
    TQLY: Math.round(clamp(base.TQLY + wave * 3, 55, 100)),
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

/** Radio / rf2bg Discover names → catalog mock keys. */
const SENSOR_ALIASES: Record<string, keyof MockTelemetry> = {
  TRSS: "1RSS",
  RSSI: "1RSS",
  RQly: "RQLY",
  LQ: "RQLY",
  TQly: "TQLY",
  Hspd: "HSpd",
  /** Nitro rotor RPM often discovered as NR. */
  NR: "HSpd",
  Tesc: "EscT",
};

export function resolveMockSensorKey(name: string): keyof MockTelemetry | null {
  if (Object.prototype.hasOwnProperty.call(BASE_MOCK, name)) {
    return name as keyof MockTelemetry;
  }
  return SENSOR_ALIASES[name] ?? null;
}

/**
 * Overlay live radio / CRSF values onto a scenario mock.
 * Unknown keys are ignored; aliases (Hspd, Tesc, NR, …) map to catalog names.
 */
export function mergeLiveIntoMock(
  base: MockTelemetry,
  live: Record<string, number | string>,
): MockTelemetry {
  const next: MockTelemetry = { ...base };
  for (const [name, value] of Object.entries(live)) {
    const key = resolveMockSensorKey(name);
    if (!key) continue;
    const current = next[key];
    if (typeof current === "number") {
      const n = typeof value === "number" ? value : Number(value);
      if (Number.isFinite(n)) next[key] = n as never;
    } else if (typeof current === "string") {
      next[key] = String(value) as never;
    }
  }
  return next;
}

export function getMockForSensor(
  name: string,
  mock: MockTelemetry,
): string | number {
  const key = resolveMockSensorKey(name);
  if (key) return mock[key];
  return 0;
}
