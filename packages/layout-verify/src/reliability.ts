import type { DrawRecord } from "./types.js";

/** True when annulus layout constants appear fully resolved (not eval stubs). */
export function isInterpretationReliable(records: DrawRecord[]): boolean {
  const annuli = records.filter((r) => r.kind === "annulus");
  if (annuli.length === 0) return true;
  return annuli.every((a) => (a.rIn ?? 0) > 0 && (a.rOut ?? 0) > 0 && (a.y ?? 0) > 80);
}
