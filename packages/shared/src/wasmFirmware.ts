/**
 * Color EdgeTX WASM radios we sync and run in the web preview.
 *
 * Only depth-16 targets whose LCD size matches knowledge/radios + layout
 * profiles. B&W / mismatched (Boxer, MT12, NV14 portrait, …) stay parser-only
 * until paint + catalog are fixed.
 */
export interface WasmRadioTarget {
  /** knowledge/radios id */
  id: string;
  /** EdgeTX flavour → edgetx-<flavour>-simulator.wasm + WasmRunner radioKey */
  flavour: string;
  name: string;
  w: number;
  h: number;
  depth: 16;
}

export const COLOR_WASM_RADIOS: readonly WasmRadioTarget[] = [
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
] as const;

export const COLOR_WASM_RADIO_IDS = COLOR_WASM_RADIOS.map((r) => r.id);

export function getColorWasmRadio(
  radioId: string,
): WasmRadioTarget | undefined {
  return COLOR_WASM_RADIOS.find((r) => r.id === radioId);
}

/** True when this knowledge radio id has a synced color WASM target. */
export function hasColorWasmSim(radioId: string): boolean {
  return getColorWasmRadio(radioId) != null;
}

export function wasmFileForFlavour(flavour: string): string {
  return `edgetx-${flavour}-simulator.wasm`;
}

export function versionedWasmFile(flavour: string, versionId: string): string {
  const short = versionId.replace(/\.0$/, "").replace(/\./g, "-");
  return `edgetx-${flavour}-${short}-simulator.wasm`;
}
