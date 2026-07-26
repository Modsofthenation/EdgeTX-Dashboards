import type { ValidationIssue } from "@widget-gen/shared";
import type { SimulateLayoutProfile } from "@widget-gen/shared";
import { findOverlaps, formatOverlapHit } from "./overlap.ts";
import { interpretWidgetLayout } from "./interpreter/luaDrawInterpreter.ts";
import { DEFAULT_LAYOUT_SCENARIO } from "./scenarios/tortureGallery.ts";
import { isInterpretationReliable } from "./reliability.ts";
import type { LayoutScenario } from "./types.ts";

export interface ValidateDrawGeometryOptions {
  scenario?: LayoutScenario;
  /** When true, overlap hits and skipped text are errors (gauge layouts). */
  strict?: boolean;
  lcdW?: number;
  lcdH?: number;
  /** When set, LCD_W/LCD_H in Lua resolve to this radio profile. */
  simulateProfile?: SimulateLayoutProfile;
}

export function validateDrawGeometry(
  source: string,
  options: ValidateDrawGeometryOptions = {},
): ValidationIssue[] {
  const scenario = options.scenario ?? DEFAULT_LAYOUT_SCENARIO;
  const { records, warnings, skippedTextCount } = interpretWidgetLayout(
    source,
    scenario,
    options.simulateProfile,
  );

  const issues: ValidationIssue[] = [];

  if (skippedTextCount > 0) {
    issues.push({
      severity: options.strict ? "error" : "warning",
      message: `Layout verify: ${skippedTextCount} drawText call(s) could not be evaluated statically`,
    });
  }

  // Annulus-only reliability for overlap; skipped text already reported above.
  if (!isInterpretationReliable(records, 0)) {
    issues.push({
      severity: options.strict ? "error" : "warning",
      message:
        "Layout verify: gauge positions could not be fully resolved statically — overlap check skipped",
    });
    return issues;
  }

  for (const w of warnings.slice(0, 3)) {
    issues.push({ severity: "warning", message: `Layout verify: ${w}` });
  }

  const hits = findOverlaps(records, {
    lcdW: options.lcdW ?? options.simulateProfile?.lcdW,
    lcdH: options.lcdH ?? options.simulateProfile?.lcdH,
  });
  const severity = options.strict ? "error" : "warning";

  for (const hit of hits.slice(0, 5)) {
    issues.push({
      severity,
      message: `${formatOverlapHit(hit)} — shrink gauge, move bars, or reduce content; see layout-reserved-rects.md`,
    });
  }
  if (hits.length > 5) {
    issues.push({
      severity,
      message: `Layout overlap: ${hits.length - 5} additional intersection(s) not shown`,
    });
  }

  return issues;
}

export function verifyLayoutNoOverlap(
  source: string,
  scenario: LayoutScenario = DEFAULT_LAYOUT_SCENARIO,
): boolean {
  const { records, skippedTextCount } = interpretWidgetLayout(source, scenario);
  if (skippedTextCount > 0) return false;
  if (!isInterpretationReliable(records, 0)) return true;
  return findOverlaps(records).length === 0;
}
