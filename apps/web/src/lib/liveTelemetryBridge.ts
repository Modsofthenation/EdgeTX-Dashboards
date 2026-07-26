/**
 * Live CRSF / ELRS telemetry via Web Serial (Chrome/Edge).
 * Parses common CRSF frames into mock-compatible sensor values for canvas + sim.
 */

export type LiveSensorMap = Record<string, number | string>;

export interface LiveTelemetryHandle {
  close: () => Promise<void>;
}

const CRSF_SYNC = 0xc8;
const LINK_ID = 0x14;
const BATTERY_ID = 0x08;
const ATTITUDE_ID = 0x1e;
const GPS_ID = 0x02;
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
    // lat/lon skipped — ground speed + sats often enough for preview
    into.GSpd = u16be(payload, 8) / 10;
    into.Alt = i16be(payload, 10);
    into.Sats = payload[14] || 0;
  } else if (type === FLIGHT_MODE_ID && payload.length > 0) {
    const end = payload.indexOf(0);
    const bytes = end >= 0 ? payload.subarray(0, end) : payload;
    into.FM = new TextDecoder().decode(bytes);
  }
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
    const total = len + 2; // addr + len + payload+crc (len includes type..crc)
    if (i + total > buffer.length) break;
    frames.push(Uint8Array.from(buffer.slice(i, i + total)));
    i += total;
  }
  // trim consumed
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
): Promise<LiveTelemetryHandle> {
  if (!isWebSerialSupported()) {
    throw new Error(
      "Web Serial is not available in this browser. Use Chrome/Edge on desktop.",
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nav = navigator as any;
  const port = await nav.serial.requestPort();
  await port.open({ baudRate: 420000 });

  const reader: ReadableStreamDefaultReader<Uint8Array> =
    port.readable.getReader();
  const buffer: number[] = [];
  const sensors: LiveSensorMap = {};
  let closed = false;

  const pump = async () => {
    while (!closed) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      for (const b of value) buffer.push(b);
      // keep buffer bounded
      if (buffer.length > 8192) buffer.splice(0, buffer.length - 4096);
      for (const frame of extractFrames(buffer)) {
        parseFrame(frame, sensors);
      }
      onValues({ ...sensors });
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
