/**
 * Live CRSF / ELRS telemetry via Web Serial (Chrome/Edge).
 * Parses common CRSF frames into mock-compatible sensor values for canvas + sim.
 *
 * Rotorflight custom sensors (HSpd, Gov, Vbec, …) are published by rf2bg on the
 * radio — they are not standard CRSF frame types on the wire. When
 * `enrichRotorflight` is enabled, missing RF keys are derived/filled so
 * StacyDash previews stay meaningful while standard CRSF streams live.
 */

export type LiveSensorMap = Record<string, number | string>;

export interface LiveTelemetryHandle {
  close: () => Promise<void>;
}

export interface OpenLiveTelemetryOptions {
  /**
   * Fill HSpd/Gov/Vbec/Vcel/Tspd/EscT/Vbat when absent from the CRSF stream.
   * Default true — needed for Rotorflight / StacyDash boards.
   */
  enrichRotorflight?: boolean;
}

const CRSF_SYNC = 0xc8;
const LINK_ID = 0x14;
const BATTERY_ID = 0x08;
const ATTITUDE_ID = 0x1e;
const GPS_ID = 0x02;
const VARIO_ID = 0x07;
const FLIGHT_MODE_ID = 0x21;

function i16be(buf: Uint8Array, off: number): number {
  const v = (buf[off]! << 8) | buf[off + 1]!;
  return v > 0x7fff ? v - 0x10000 : v;
}

function u16be(buf: Uint8Array, off: number): number {
  return ((buf[off]! << 8) | buf[off + 1]!) >>> 0;
}

function u24be(buf: Uint8Array, off: number): number {
  return ((buf[off]! << 16) | (buf[off + 1]! << 8) | buf[off + 2]!) >>> 0;
}

function parseFrame(frame: Uint8Array, into: LiveSensorMap): void {
  if (frame.length < 3 || frame[0] !== CRSF_SYNC) return;
  const type = frame[2]!;
  const payload = frame.subarray(3);

  if (type === LINK_ID && payload.length >= 8) {
    into["1RSS"] = -(payload[0] || 0);
    into["2RSS"] = -(payload[1] || 0);
    into.RQLY = payload[2] || 0;
    into.TQLY = payload[8] || into.TQLY || 0;
    into.TPWR =
      [0, 10, 25, 100, 500, 1000, 2000, 250, 50][payload[6] || 3] ?? 100;
  } else if (type === BATTERY_ID && payload.length >= 7) {
    into.RxBt = u16be(payload, 0) / 10;
    into.Curr = u16be(payload, 2) / 10;
    into.Capa = u24be(payload, 4);
    if (payload.length >= 8) into["Bat%"] = payload[7] || 0;
  } else if (type === ATTITUDE_ID && payload.length >= 6) {
    into.Ptch = i16be(payload, 0) / 10000;
    into.Roll = i16be(payload, 2) / 10000;
    into.Yaw = i16be(payload, 4) / 10000;
  } else if (type === GPS_ID && payload.length >= 15) {
    into.GSpd = u16be(payload, 8) / 10;
    into.Alt = i16be(payload, 10);
    into.Sats = payload[14] || 0;
  } else if (type === VARIO_ID && payload.length >= 2) {
    // Vertical speed (cm/s) — unused by StacyDash but keeps map fresh
    into.VSpd = i16be(payload, 0) / 10;
  } else if (type === FLIGHT_MODE_ID && payload.length > 0) {
    const end = payload.indexOf(0);
    const bytes = end >= 0 ? payload.subarray(0, end) : payload;
    into.FM = new TextDecoder().decode(bytes);
  }
}

/**
 * Derive rf2bg-style sensors for preview when only standard CRSF is on the wire.
 * Does not overwrite keys already present from the serial stream.
 */
export function enrichRotorflightLiveSensors(
  live: LiveSensorMap,
  tick = 0,
): LiveSensorMap {
  const next: LiveSensorMap = { ...live };
  const wave = Math.sin(tick / 20);
  const rxbt = typeof next.RxBt === "number" ? next.RxBt : 16.2;
  const cells = rxbt > 18 ? 6 : rxbt > 12 ? 4 : 3;

  if (next.Vbat == null) next.Vbat = Math.round(rxbt * 10) / 10;
  if (next.Vcel == null)
    next.Vcel = Math.round((rxbt / cells + wave * 0.01) * 100) / 100;
  if (next.Vbec == null) next.Vbec = Math.round((8.3 + wave * 0.05) * 10) / 10;

  const rpm =
    typeof next.RPM === "number"
      ? next.RPM
      : typeof next.HSpd === "number"
        ? next.HSpd
        : 1850 + wave * 40;
  if (next.HSpd == null) next.HSpd = Math.round(Number(rpm));
  if (next.NR == null) next.NR = next.HSpd;
  if (next.Tspd == null)
    next.Tspd = Math.round(Number(next.HSpd) / 4.5 + wave * 5);
  if (next.EscT == null) next.EscT = Math.round(42 + wave * 2);
  if (next.MotT == null) next.MotT = Math.round(55 + wave * 2);

  if (next.Gov == null) {
    const fm = typeof next.FM === "string" ? next.FM.toLowerCase() : "";
    if (fm.includes("hold") || fm.includes("off")) next.Gov = 0;
    else if (fm.includes("idle")) next.Gov = 1;
    else if (fm.includes("spool")) next.Gov = 2;
    else next.Gov = 3;
  }

  return next;
}

function extractFrames(buffer: number[]): Uint8Array[] {
  const frames: Uint8Array[] = [];
  let i = 0;
  while (i < buffer.length) {
    if (buffer[i] !== CRSF_SYNC) {
      i++;
      continue;
    }
    if (i + 1 >= buffer.length) break;
    const len = buffer[i + 1]!;
    const total = len + 2;
    if (i + total > buffer.length) break;
    frames.push(Uint8Array.from(buffer.slice(i, i + total)));
    i += total;
  }
  buffer.splice(0, i);
  return frames;
}

export function isWebSerialSupported(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

/**
 * Prompt for a serial port and stream CRSF frames into `onValues`.
 */
export async function openLiveTelemetryPort(
  onValues: (values: LiveSensorMap) => void,
  options: OpenLiveTelemetryOptions = {},
): Promise<LiveTelemetryHandle> {
  if (!isWebSerialSupported()) {
    throw new Error(
      "Web Serial is not available in this browser. Use Chrome/Edge on desktop.",
    );
  }

  const enrich = options.enrichRotorflight !== false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nav = navigator as any;
  const port = await nav.serial.requestPort();
  await port.open({ baudRate: 420000 });

  const reader: ReadableStreamDefaultReader<Uint8Array> =
    port.readable.getReader();
  const buffer: number[] = [];
  const sensors: LiveSensorMap = {};
  let closed = false;
  let tick = 0;

  const pump = async () => {
    while (!closed) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      for (const b of value) buffer.push(b);
      if (buffer.length > 8192) buffer.splice(0, buffer.length - 4096);
      for (const frame of extractFrames(buffer)) {
        parseFrame(frame, sensors);
      }
      tick += 1;
      const out = enrich
        ? enrichRotorflightLiveSensors(sensors, tick)
        : { ...sensors };
      onValues(out);
    }
  };

  void pump().catch(() => {
    /* port closed */
  });

  return {
    close: async () => {
      closed = true;
      try {
        reader.releaseLock();
      } catch {
        /* ignore */
      }
      try {
        await port.close();
      } catch {
        /* ignore */
      }
    },
  };
}
