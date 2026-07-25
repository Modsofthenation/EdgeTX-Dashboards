import {
  DEFAULT_EDGE_TX_VERSION,
  normalizeEdgeTxVersion,
} from "~/lib/edgeTxVersions";

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

export interface SimManifest {
  defaultVersion: string;
  source?: string;
  syncedAt?: string;
  versions?: Record<string, SimFirmwareVersionEntry>;
  /** Legacy single-version manifest (pre multi-version). */
  radios?: {
    tx15?: {
      name: string;
      wasm: string;
      sha256?: string;
      size?: number;
      display?: SimDisplayProfile;
    };
  };
}

export interface SimFirmwareResolution {
  requestedVersion: string;
  effectiveVersion: string;
  wasmUrl: string;
  label: string;
  size: number;
  aliasOf?: string;
  /** Requested version had no manifest entry; using default firmware. */
  fallback?: boolean;
}

export function resolveSimFirmware(
  manifest: SimManifest,
  edgeTxVersion: string,
): SimFirmwareResolution {
  const requestedVersion = normalizeEdgeTxVersion(edgeTxVersion);
  const versions = manifest.versions ?? {};
  const defaultVersion = manifest.defaultVersion || DEFAULT_EDGE_TX_VERSION;

  let entry = versions[requestedVersion];
  let fallback = false;

  if (!entry) {
    entry = versions[defaultVersion];
    fallback = true;
  }

  if (!entry) {
    const legacy = manifest.radios?.tx15;
    if (legacy?.wasm) {
      return {
        requestedVersion,
        effectiveVersion: defaultVersion,
        wasmUrl: `/sim/${legacy.wasm}`,
        label: "2.11",
        size: legacy.size ?? 0,
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
    wasmUrl: `/sim/${effective.wasm}`,
    label: entry.label,
    size: effective.size,
    aliasOf: entry.aliasOf,
    fallback: fallback && !entry.aliasOf,
  };
}
