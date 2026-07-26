import {
  DEFAULT_EDGE_TX_VERSION,
  normalizeEdgeTxVersion,
} from "~/lib/edgeTxVersions";
import {
  getColorWasmRadio,
  hasColorWasmSim,
  wasmFileForFlavour,
} from "@widget-gen/shared";

export interface SimDisplayProfile {
  w: number;
  h: number;
  depth: number;
}

export interface SimFirmwareVersionEntry {
  label: string;
  wasm: string;
  sha256: string;
  size: number;
  display: SimDisplayProfile;
  /** When blob host serves the same bytes as another version. */
  aliasOf?: string;
}

export interface SimRadioManifestEntry {
  name: string;
  /** EdgeTX flavour / WasmRunner radioKey (e.g. tx16s). */
  flavour?: string;
  wasm: string;
  sha256?: string;
  size?: number;
  display?: SimDisplayProfile;
}

export interface SimManifest {
  defaultVersion: string;
  defaultRadio?: string;
  source?: string;
  syncedAt?: string;
  versions?: Record<string, SimFirmwareVersionEntry>;
  radios?: Record<string, SimRadioManifestEntry>;
}

export interface SimFirmwareResolution {
  requestedVersion: string;
  effectiveVersion: string;
  radioId: string;
  /** WasmRunner / EdgeTX flavour key (e.g. tx15, tx16s). */
  radioKey: string;
  wasmUrl: string;
  label: string;
  size: number;
  display?: SimDisplayProfile;
  aliasOf?: string;
  /** Requested version had no manifest entry; using default firmware. */
  fallback?: boolean;
}

export { hasColorWasmSim, getColorWasmRadio, wasmFileForFlavour };

export function resolveSimFirmware(
  manifest: SimManifest,
  edgeTxVersion: string,
  radioId = "tx15",
): SimFirmwareResolution {
  const requestedVersion = normalizeEdgeTxVersion(edgeTxVersion);
  const versions = manifest.versions ?? {};
  const defaultVersion = manifest.defaultVersion || DEFAULT_EDGE_TX_VERSION;
  const radios = manifest.radios ?? {};

  const catalog = getColorWasmRadio(radioId);
  const radioEntry =
    radios[radioId] ?? (radioId === "tx15" ? radios.tx15 : undefined);
  const radioKey =
    radioEntry?.flavour ??
    catalog?.flavour ??
    (radioId === "tx15" ? "tx15" : radioId);

  // Non-TX15 color radios: prefer radios map (unversioned blob per flavour).
  if (radioId !== "tx15") {
    if (radioEntry?.wasm) {
      return {
        requestedVersion,
        effectiveVersion: defaultVersion,
        radioId,
        radioKey,
        wasmUrl: `/sim/${radioEntry.wasm}`,
        label:
          versions[defaultVersion]?.label ?? defaultVersion.replace(/\.0$/, ""),
        size: radioEntry.size ?? 0,
        display:
          radioEntry.display ??
          (catalog
            ? { w: catalog.w, h: catalog.h, depth: catalog.depth }
            : undefined),
      };
    }
    if (catalog) {
      const wasm = wasmFileForFlavour(catalog.flavour);
      return {
        requestedVersion,
        effectiveVersion: defaultVersion,
        radioId,
        radioKey: catalog.flavour,
        wasmUrl: `/sim/${wasm}`,
        label: defaultVersion.replace(/\.0$/, ""),
        size: 0,
        display: { w: catalog.w, h: catalog.h, depth: catalog.depth },
        fallback: true,
      };
    }
    throw new Error(`No WASM firmware mapped for radio "${radioId}"`);
  }

  // TX15: version-aware path (legacy + versions map).
  let entry = versions[requestedVersion];
  let fallback = false;

  if (!entry) {
    entry = versions[defaultVersion];
    fallback = true;
  }

  if (!entry) {
    const legacy = radios.tx15;
    if (legacy?.wasm) {
      return {
        requestedVersion,
        effectiveVersion: defaultVersion,
        radioId: "tx15",
        radioKey: "tx15",
        wasmUrl: `/sim/${legacy.wasm}`,
        label: "2.11",
        size: legacy.size ?? 0,
        display: legacy.display,
        fallback: true,
      };
    }
    throw new Error("Radio sim manifest is missing firmware versions");
  }

  let effectiveVersion = fallback ? defaultVersion : requestedVersion;
  let effective = entry;

  if (entry.aliasOf && versions[entry.aliasOf]) {
    effectiveVersion = entry.aliasOf;
    effective = versions[entry.aliasOf];
  }

  return {
    requestedVersion,
    effectiveVersion,
    radioId: "tx15",
    radioKey: "tx15",
    wasmUrl: `/sim/${effective.wasm}`,
    label: entry.label,
    size: effective.size,
    display: effective.display,
    aliasOf: entry.aliasOf,
    fallback: fallback && !entry.aliasOf,
  };
}
