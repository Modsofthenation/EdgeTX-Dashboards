/** EdgeTX targets exposed in chat composer (semver patch form). */
export const EDGE_TX_VERSION_OPTIONS = [
  { value: "2.12.0", label: "2.12" },
  { value: "2.11.0", label: "2.11+" },
  { value: "2.10.0", label: "2.10" },
] as const;

export const DEFAULT_EDGE_TX_VERSION = "2.11.0";

/** Stub folder keys vendored under `stubs/<major.minor>/`. */
export const EDGE_TX_STUB_VERSIONS = ["2.10", "2.11", "2.12"] as const;
export type EdgeTxStubVersion = (typeof EDGE_TX_STUB_VERSIONS)[number];

/** Normalize chat dropdown values to manifest keys (`2.12` → `2.12.0`). */
export function normalizeEdgeTxVersion(version: string): string {
  const match = version.trim().match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match) return DEFAULT_EDGE_TX_VERSION;
  const [, major, minor, patch = "0"] = match;
  return `${major}.${minor}.${patch}`;
}

export function edgeTxVersionLabel(version: string): string {
  const normalized = normalizeEdgeTxVersion(version);
  const option = EDGE_TX_VERSION_OPTIONS.find(
    (entry) => entry.value === normalized,
  );
  return option?.label ?? normalized.replace(/\.0$/, "");
}

/**
 * Map a UI/manifest EdgeTX version to the LuaLS stub folder key.
 * Exact major.minor wins; otherwise nearest lower stub, else nearest higher.
 */
export function stubFolderForEdgeTxVersion(version: string): EdgeTxStubVersion {
  const normalized = normalizeEdgeTxVersion(version);
  const match = normalized.match(/^(\d+)\.(\d+)/);
  if (!match) return "2.11";
  const key = `${match[1]}.${match[2]}` as EdgeTxStubVersion;
  if ((EDGE_TX_STUB_VERSIONS as readonly string[]).includes(key)) return key;

  const target = Number(match[1]) * 1000 + Number(match[2]);
  let bestLower: EdgeTxStubVersion | null = null;
  let bestLowerScore = -Infinity;
  let bestHigher: EdgeTxStubVersion | null = null;
  let bestHigherScore = Infinity;
  for (const stub of EDGE_TX_STUB_VERSIONS) {
    const [sMaj, sMin] = stub.split(".").map(Number) as [number, number];
    const score = sMaj * 1000 + sMin;
    if (score <= target && score > bestLowerScore) {
      bestLower = stub;
      bestLowerScore = score;
    }
    if (score >= target && score < bestHigherScore) {
      bestHigher = stub;
      bestHigherScore = score;
    }
  }
  return bestLower ?? bestHigher ?? "2.11";
}
