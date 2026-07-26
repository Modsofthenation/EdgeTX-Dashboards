import type { MockTelemetry } from "@widget-gen/layout-verify";
import { BASE_MOCK } from "@widget-gen/layout-verify";

export type MockTelemetryValues = MockTelemetry;

// CRSF frame builders — ported from EdgeTX Dev Kit ExtensionTelemetry.tsx

const CRSF_ADDR = 0xc8;
const LINK_ID = 0x14;
const BATTERY_ID = 0x08;
const ATTITUDE_ID = 0x1e;
const GPS_ID = 0x02;
const FLIGHT_MODE_ID = 0x21;
const VARIO_ID = 0x07;

const TX_POWER_MW = [0, 10, 25, 100, 500, 1000, 2000, 250, 50];

function i16be(buf: Uint8Array, off: number, v: number): void {
  buf[off] = (v >> 8) & 0xff;
  buf[off + 1] = v & 0xff;
}

function i32be(buf: Uint8Array, off: number, v: number): void {
  buf[off] = (v >> 24) & 0xff;
  buf[off + 1] = (v >> 16) & 0xff;
  buf[off + 2] = (v >> 8) & 0xff;
  buf[off + 3] = v & 0xff;
}

function i24be(buf: Uint8Array, off: number, v: number): void {
  buf[off] = (v >> 16) & 0xff;
  buf[off + 1] = (v >> 8) & 0xff;
  buf[off + 2] = v & 0xff;
}

function rssiToCrsf(dbm: number): number {
  return Math.abs(Math.round(dbm)) & 0xff;
}

function txPowerIndex(mw: number): number {
  const idx = TX_POWER_MW.indexOf(mw);
  return idx >= 0 ? idx : 3;
}

function buildLinkFrame(mock: MockTelemetryValues): number[] {
  const buf = new Uint8Array(13);
  buf[0] = CRSF_ADDR;
  buf[1] = 11;
  buf[2] = LINK_ID;
  buf[3] = rssiToCrsf(mock["1RSS"]);
  buf[4] = rssiToCrsf(mock["2RSS"]);
  buf[5] = Math.round(mock.RQLY) & 0xff;
  buf[6] = 15;
  buf[7] = 1;
  buf[8] = 4;
  buf[9] = txPowerIndex(mock.TPWR) & 0xff;
  buf[10] = rssiToCrsf(mock["1RSS"] + 5);
  buf[11] = Math.round(mock.TQLY) & 0xff;
  buf[12] = 12;
  return Array.from(buf);
}

function buildBatteryFrame(mock: MockTelemetryValues): number[] {
  const buf = new Uint8Array(12);
  buf[0] = CRSF_ADDR;
  buf[1] = 10;
  buf[2] = BATTERY_ID;
  i16be(buf, 3, Math.round(mock.RxBt * 10));
  i16be(buf, 5, Math.round(mock.Curr * 10));
  i24be(buf, 7, Math.round(mock.Capa));
  buf[10] = Math.round(mock["Bat%"]) & 0xff;
  return Array.from(buf);
}

function buildAttitudeFrame(mock: MockTelemetryValues): number[] {
  const buf = new Uint8Array(9);
  buf[0] = CRSF_ADDR;
  buf[1] = 7;
  buf[2] = ATTITUDE_ID;
  i16be(buf, 3, Math.round(mock.Ptch * 10000));
  i16be(buf, 5, Math.round(mock.Roll * 10000));
  i16be(buf, 7, Math.round(mock.Yaw * 10000));
  return Array.from(buf);
}

function buildGpsFrame(mock: MockTelemetryValues): number[] {
  const buf = new Uint8Array(19);
  buf[0] = CRSF_ADDR;
  buf[1] = 17;
  buf[2] = GPS_ID;
  i32be(buf, 3, 437654321);
  i32be(buf, 7, -792345678);
  i16be(buf, 11, Math.round(mock.GSpd * 10));
  i16be(buf, 13, Math.round(mock.Hdg * 100));
  i16be(buf, 15, Math.round(mock.Alt + 1000));
  buf[17] = Math.round(mock.Sats) & 0xff;
  return Array.from(buf);
}

function buildFlightModeFrame(mode: string): number[] {
  const text = mode.slice(0, 13);
  const encoded = new TextEncoder().encode(text);
  const payloadLen = 3 + encoded.length;
  const buf = new Uint8Array(2 + payloadLen);
  buf[0] = CRSF_ADDR;
  buf[1] = payloadLen;
  buf[2] = FLIGHT_MODE_ID;
  buf.set(encoded, 3);
  return Array.from(buf);
}

function buildVarioFrame(vspdCmps: number): number[] {
  const buf = new Uint8Array(5);
  buf[0] = CRSF_ADDR;
  buf[1] = 3;
  buf[2] = VARIO_ID;
  i16be(buf, 3, vspdCmps);
  return Array.from(buf);
}

/** Build CRSF telemetry batch from mock values (matches Dev Kit streaming set). */
export function buildTelemetryFrames(mock: MockTelemetryValues): number[][] {
  return [
    buildLinkFrame(mock),
    buildBatteryFrame(mock),
    buildAttitudeFrame(mock),
    buildGpsFrame(mock),
    buildFlightModeFrame(mock.FM),
    buildVarioFrame(0),
  ];
}

/** CRSF protocol id for simuSendTelemetry. */
export const CRSF_TELEMETRY_PROTOCOL = 2;

/** Internal (0) and external (1) module bays — inject both until model bay is known. */
export const CRSF_TELEMETRY_MODULES = [0, 1] as const;

/** Inject CRSF frames via simuSendTelemetry (protocol 2). */
export function injectTelemetryFrames(
  exports: {
    malloc: (size: number) => number;
    free: (ptr: number) => void;
    memory: WebAssembly.Memory;
    simuSendTelemetry: (
      mod: number,
      protocol: number,
      ptr: number,
      frameLen: number,
    ) => void;
  },
  frames: number[][],
  modules: readonly number[] = CRSF_TELEMETRY_MODULES,
): void {
  for (const frameData of frames) {
    if (!frameData.length) continue;
    const bytes = new Uint8Array(frameData);
    const ptr = exports.malloc(bytes.length);
    if (!ptr) continue;
    new Uint8Array(exports.memory.buffer).set(bytes, ptr);
    for (const mod of modules) {
      exports.simuSendTelemetry(
        mod,
        CRSF_TELEMETRY_PROTOCOL,
        ptr,
        bytes.length,
      );
    }
    exports.free(ptr);
  }
}

/** Shared with layout-verify — single mock telemetry source of truth. */
export const BASE_MOCK_TELEMETRY: MockTelemetryValues = { ...BASE_MOCK };
