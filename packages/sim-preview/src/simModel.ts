/**
 * Minimal EdgeTX model for WASM radio sim: internal CRSF module + Betaflight-style
 * telemetry sensor labels (matches widget getSourceIndex() names).
 */

export const SIM_MODEL1_PATH = "/MODELS/model1.yml";

/**
 * Model `view` index for custom screen 0 on TX15 / Horus-class 2.11 firmware.
 * simuLoadWidgetByLayout also navigates; this ensures boot lands on the dashboard.
 */
export const SIM_CUSTOM_SCREEN_VIEW = 7;

export interface SimWidgetLayoutPlan {
  widgetName: string;
  layoutId: string;
  zoneIndex: number;
}

/** Betaflight CRSF sensor names used by generated widgets. */
export const SIM_TELEMETRY_SENSOR_LABELS = [
  "RQLY",
  "TRSS",
  "RxBt",
  "Bat%",
  "Curr",
  "Capa",
  "Alt",
  "GSpd",
  "Sats",
  "FM",
] as const;

/**
 * Trim model with internal TYPE_CROSSFIRE and pre-seeded telemetry sensors.
 * Sensor ids mirror CRSF link (0x14) and battery (0x08) mappings from EdgeTX.
 */
export const SIM_MODEL1_YML = `semver: 2.11.0
header:
  name: SimWidget
  bitmap: ""
  labels: ""
timers:
  0:
    swtch: NONE
    mode: THR
    name: ""
    minuteBeep: 0
    countdownBeep: 0
    start: 0
    persistent: 0
    countdownStart: 0
    value: 0
    showElapsed: 0
    extraHaptic: 0
mixData:
  - destCh: 0
    srcRaw: I0
    weight: 100
    swtch: NONE
    curve:
      type: 0
      value: 0
    delayUp: 0
    delayDown: 0
    speedUp: 0
    speedDown: 0
    carryTrim: 0
    mltpx: ADD
    mixWarn: 0
    flightModes: 000000000
    offset: 0
    name: ""
  - destCh: 1
    srcRaw: I1
    weight: 100
    swtch: NONE
    curve:
      type: 0
      value: 0
    delayUp: 0
    delayDown: 0
    speedUp: 0
    speedDown: 0
    carryTrim: 0
    mltpx: ADD
    mixWarn: 0
    flightModes: 000000000
    offset: 0
    name: ""
  - destCh: 2
    srcRaw: I2
    weight: 100
    swtch: NONE
    curve:
      type: 0
      value: 0
    delayUp: 0
    delayDown: 0
    speedUp: 0
    speedDown: 0
    carryTrim: 0
    mltpx: ADD
    mixWarn: 0
    flightModes: 000000000
    offset: 0
    name: ""
  - destCh: 3
    srcRaw: I3
    weight: 100
    swtch: NONE
    curve:
      type: 0
      value: 0
    delayUp: 0
    delayDown: 0
    speedUp: 0
    speedDown: 0
    carryTrim: 0
    mltpx: ADD
    mixWarn: 0
    flightModes: 000000000
    offset: 0
    name: ""
limitData:
  0:
    min: 0
    max: 0
    revert: 1
    offset: 0
    ppmCenter: 0
    symetrical: 0
    name: ""
    curve: 0
  1:
    min: 0
    max: 0
    revert: 1
    offset: 0
    ppmCenter: 0
    symetrical: 0
    name: ""
    curve: 0
  2:
    min: 0
    max: 0
    revert: 1
    offset: 0
    ppmCenter: 0
    symetrical: 0
    name: ""
    curve: 0
  3:
    min: 0
    max: 0
    revert: 1
    offset: 0
    ppmCenter: 0
    symetrical: 0
    name: ""
    curve: 0
expoData:
  - srcRaw: Rud
    scale: 0
    mode: 3
    chn: 3
    swtch: NONE
    flightModes: 000000000
    weight: 100
    offset: 0
    curve:
      type: 0
      value: 0
    trimSource: 0
    name: ""
thrTraceSrc: ch(2)
telemetryProtocol: 0
rssiSource: none
disableTelemetryWarning: 1
moduleData:
  1:
    type: TYPE_CROSSFIRE
    channelsStart: 0
    channelsCount: 16
    failsafeMode: NOT_SET
    mod:
      crsf:
        telemetryBaudrate: 0
telemetrySensors:
  0:
    type: TYPE_CUSTOM
    id1:
      id: 20
      subId: 0
    id2:
      instance: 2
    label: RQLY
    unit: 13
    prec: 0
    autoOffset: 0
    filter: 0
    logs: 0
    persistent: 0
    onlyPositive: 0
    cfg:
      custom:
        ratio: 0
        offset: 0
  1:
    type: TYPE_CUSTOM
    id1:
      id: 20
      subId: 0
    id2:
      instance: 7
    label: TRSS
    unit: 17
    prec: 0
    autoOffset: 0
    filter: 0
    logs: 0
    persistent: 0
    onlyPositive: 0
    cfg:
      custom:
        ratio: 0
        offset: 0
  2:
    type: TYPE_CUSTOM
    id1:
      id: 8
      subId: 0
    id2:
      instance: 0
    label: RxBt
    unit: 1
    prec: 1
    autoOffset: 0
    filter: 0
    logs: 0
    persistent: 0
    onlyPositive: 0
    cfg:
      custom:
        ratio: 0
        offset: 0
  3:
    type: TYPE_CUSTOM
    id1:
      id: 8
      subId: 0
    id2:
      instance: 1
    label: Curr
    unit: 2
    prec: 1
    autoOffset: 0
    filter: 0
    logs: 0
    persistent: 0
    onlyPositive: 0
    cfg:
      custom:
        ratio: 0
        offset: 0
  4:
    type: TYPE_CUSTOM
    id1:
      id: 8
      subId: 0
    id2:
      instance: 2
    label: Capa
    unit: 14
    prec: 0
    autoOffset: 0
    filter: 0
    logs: 0
    persistent: 0
    onlyPositive: 0
    cfg:
      custom:
        ratio: 0
        offset: 0
  5:
    type: TYPE_CUSTOM
    id1:
      id: 8
      subId: 0
    id2:
      instance: 3
    label: Bat%
    unit: 13
    prec: 0
    autoOffset: 0
    filter: 0
    logs: 0
    persistent: 0
    onlyPositive: 0
    cfg:
      custom:
        ratio: 0
        offset: 0
  6:
    type: TYPE_CUSTOM
    id1:
      id: 2
      subId: 0
    id2:
      instance: 2
    label: Alt
    unit: 9
    prec: 0
    autoOffset: 0
    filter: 0
    logs: 0
    persistent: 0
    onlyPositive: 0
    cfg:
      custom:
        ratio: 0
        offset: 0
  7:
    type: TYPE_CUSTOM
    id1:
      id: 2
      subId: 0
    id2:
      instance: 1
    label: GSpd
    unit: 5
    prec: 0
    autoOffset: 0
    filter: 0
    logs: 0
    persistent: 0
    onlyPositive: 0
    cfg:
      custom:
        ratio: 0
        offset: 0
  8:
    type: TYPE_CUSTOM
    id1:
      id: 2
      subId: 0
    id2:
      instance: 4
    label: Sats
    unit: 0
    prec: 0
    autoOffset: 0
    filter: 0
    logs: 0
    persistent: 0
    onlyPositive: 0
    cfg:
      custom:
        ratio: 0
        offset: 0
  9:
    type: TYPE_CUSTOM
    id1:
      id: 33
      subId: 0
    id2:
      instance: 0
    label: FM
    unit: 0
    prec: 0
    autoOffset: 0
    filter: 0
    logs: 0
    persistent: 0
    onlyPositive: 0
    cfg:
      custom:
        ratio: 0
        offset: 0
`;

export type SimFsWriter = {
  fsWriteFile: (path: string, data: ArrayBuffer) => Promise<void>;
  fsReadFile?: (path: string) => Promise<ArrayBuffer | null>;
};

/** YAML fragment: custom screen 0 with widget assigned to a layout zone. */
export function buildScreenDataYaml(
  layoutId: string,
  zoneIndex: number,
  widgetName: string
): string {
  return `screenData:
  "0":
    LayoutId: ${layoutId}
    layoutData:
      zones:
        "${zoneIndex}":
          widgetName: ${widgetName}
view: ${SIM_CUSTOM_SCREEN_VIEW}`;
}

/** CRSF model YAML, optionally with pre-assigned dashboard widget in screen 0. */
export function buildSimModelYaml(layoutPlan?: SimWidgetLayoutPlan): string {
  const base = SIM_MODEL1_YML.trimEnd();
  if (!layoutPlan) return `${base}\n`;
  return `${base}\n${buildScreenDataYaml(
    layoutPlan.layoutId,
    layoutPlan.zoneIndex,
    layoutPlan.widgetName
  )}\n`;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** Patch radio.yml internal module to CRSF when simCreateDefaults left it unset. */
export async function patchRadioInternalCrsf(fs: SimFsWriter): Promise<void> {
  if (!fs.fsReadFile) return;
  const buf = await fs.fsReadFile("/RADIO/radio.yml");
  if (!buf) return;

  let text = new TextDecoder().decode(buf);
  if (text.includes("TYPE_CROSSFIRE")) return;

  if (/internalModule:\s*\S+/m.test(text)) {
    text = text.replace(/internalModule:\s*\S+/m, "internalModule: TYPE_CROSSFIRE");
  } else {
    text = `internalModule: TYPE_CROSSFIRE\n${text}`;
  }

  await fs.fsWriteFile("/RADIO/radio.yml", toArrayBuffer(new TextEncoder().encode(text)));
}

/** Overwrite default model1.yml with CRSF + optional dashboard widget assignment. */
export async function deploySimModel(
  fs: SimFsWriter,
  layoutPlan?: SimWidgetLayoutPlan
): Promise<void> {
  const yaml = buildSimModelYaml(layoutPlan);
  await fs.fsWriteFile(SIM_MODEL1_PATH, toArrayBuffer(new TextEncoder().encode(yaml)));
  await patchRadioInternalCrsf(fs);
}
