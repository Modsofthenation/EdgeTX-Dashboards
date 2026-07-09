import type { DrawRecord } from "./types.js";

/**
 * True when annulus layout constants appear fully resolved (not eval stubs).
 * Pass skippedTextCount from interpret meta to treat unresolved text as unreliable.
 */
export function isInterpretationReliable(
  records: DrawRecord[],
  skippedTextCount = 0
): boolean {
  if (skippedTextCount > 0) return false;

  const annuli = records.filter((r) => r.kind === "annulus");
  if (annuli.length === 0) return true;
  return annuli.every((a) => (a.rIn ?? 0) > 0 && (a.rOut ?? 0) > 0 && (a.y ?? 0) > 80);
}
