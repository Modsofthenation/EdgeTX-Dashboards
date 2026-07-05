/** EdgeTX targets exposed in chat composer (semver patch form). */
export const EDGE_TX_VERSION_OPTIONS = [
  { value: "2.12.0", label: "2.12" },
  { value: "2.11.0", label: "2.11+" },
  { value: "2.10.0", label: "2.10" },
] as const;

export const DEFAULT_EDGE_TX_VERSION = "2.11.0";

/** Normalize chat dropdown values to manifest keys (`2.12` → `2.12.0`). */
export function normalizeEdgeTxVersion(version: string): string {
  const match = version.trim().match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match) return DEFAULT_EDGE_TX_VERSION;
  const [, major, minor, patch = "0"] = match;
  return `${major}.${minor}.${patch}`;
}

export function edgeTxVersionLabel(version: string): string {
  const normalized = normalizeEdgeTxVersion(version);
  const option = EDGE_TX_VERSION_OPTIONS.find((entry) => entry.value === normalized);
  return option?.label ?? normalized.replace(/\.0$/, "");
}
