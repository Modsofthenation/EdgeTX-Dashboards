/**
 * EdgeTX WASM radios we sync and run in the web preview.
 *
 * Includes color (depth 16) and B&W (depth 1) targets whose LCD size matches
 * knowledge/radios + layout profiles. Depth-4 targets can use the same paint
 * path once catalogued.
 */
export interface WasmRadioTarget {
  /** knowledge/radios id */
  id: string;
  /** EdgeTX flavour → edgetx-<flavour>-simulator.wasm + WasmRunner radioKey */
  flavour: string;
  name: string;
  w: number;
  h: number;
  depth: 1 | 4 | 16;
}

export const WASM_RADIOS: readonly WasmRadioTarget[] = [
  {
    id: "tx15",
    flavour: "tx15",
    name: "RadioMaster TX15",
    w: 480,
    h: 320,
    depth: 16,
  },
  {
    id: "tx16",
    flavour: "tx16s",
    name: "RadioMaster TX16S",
    w: 480,
    h: 272,
    depth: 16,
  },
  {
    id: "t16",
    flavour: "t16",
    name: "Jumper T16",
    w: 480,
    h: 272,
    depth: 16,
  },
  {
    id: "t18",
    flavour: "t18",
    name: "Jumper T18",
    w: 480,
    h: 272,
    depth: 16,
  },
  {
    id: "x10",
    flavour: "x10",
    name: "FrSky Horus X10",
    w: 480,
    h: 272,
    depth: 16,
  },
  {
    id: "x12",
    flavour: "x12s",
    name: "FrSky Horus X12S",
    w: 480,
    h: 272,
    depth: 16,
  },
  {
    id: "nv14",
    flavour: "nv14",
    name: "Flysky NV14 / EL18",
    w: 320,
    h: 480,
    depth: 16,
  },
  {
    id: "boxer",
    flavour: "boxer",
    name: "RadioMaster Boxer",
    w: 128,
    h: 64,
    depth: 1,
  },
  {
    id: "mt12",
    flavour: "mt12",
    name: "RadioMaster MT12",
    w: 128,
    h: 64,
    depth: 1,
  },
  {
    id: "zorro",
    flavour: "zorro",
    name: "RadioMaster Zorro",
    w: 128,
    h: 64,
    depth: 1,
  },
  {
    id: "tx12",
    flavour: "tx12mk2",
    name: "RadioMaster TX12 MKII",
    w: 128,
    h: 64,
    depth: 1,
  },
  {
    id: "t20",
    flavour: "t20",
    name: "Jumper T20",
    w: 128,
    h: 64,
    depth: 1,
  },
  {
    id: "x7",
    flavour: "x7access",
    name: "FrSky Taranis X7 / X7S",
    w: 128,
    h: 64,
    depth: 1,
  },
] as const;

/** Color-only subset (depth 16). Prefer WASM_RADIOS for new code. */
export const COLOR_WASM_RADIOS: readonly WasmRadioTarget[] = WASM_RADIOS.filter(
  (r) => r.depth === 16,
);

export const WASM_RADIO_IDS = WASM_RADIOS.map((r) => r.id);
export const COLOR_WASM_RADIO_IDS = COLOR_WASM_RADIOS.map((r) => r.id);

export function getWasmRadio(radioId: string): WasmRadioTarget | undefined {
  return WASM_RADIOS.find((r) => r.id === radioId);
}

/** @deprecated Prefer getWasmRadio — kept for call-site compatibility. */
export function getColorWasmRadio(
  radioId: string,
): WasmRadioTarget | undefined {
  return getWasmRadio(radioId);
}

/** True when this knowledge radio id has a synced WASM target. */
export function hasWasmSim(radioId: string): boolean {
  return getWasmRadio(radioId) != null;
}

/** @deprecated Prefer hasWasmSim — includes B&W once paint lands. */
export function hasColorWasmSim(radioId: string): boolean {
  return hasWasmSim(radioId);
}

export function wasmFileForFlavour(flavour: string): string {
  return `edgetx-${flavour}-simulator.wasm`;
}

export function versionedWasmFile(flavour: string, versionId: string): string {
  const short = versionId.replace(/\.0$/, "").replace(/\./g, "-");
  return `edgetx-${flavour}-${short}-simulator.wasm`;
}
