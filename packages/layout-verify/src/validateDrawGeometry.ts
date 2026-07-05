import type { ValidationIssue } from "@widget-gen/shared";
import { findOverlaps, formatOverlapHit } from "./overlap.js";
import { interpretWidgetLayout } from "./interpreter/luaDrawInterpreter.js";
import { DEFAULT_LAYOUT_SCENARIO } from "./scenarios/tortureGallery.js";
import { isInterpretationReliable } from "./reliability.js";
import type { LayoutScenario } from "./types.js";

export interface ValidateDrawGeometryOptions {
  scenario?: LayoutScenario;
  /** When true, overlap hits are errors (gauge layouts). */
  strict?: boolean;
  lcdW?: number;
  lcdH?: number;
}

export function validateDrawGeometry(
  source: string,
  options: ValidateDrawGeometryOptions = {}
): ValidationIssue[] {
  const scenario = options.scenario ?? DEFAULT_LAYOUT_SCENARIO;
  const { records, warnings, skippedTextCount } = interpretWidgetLayout(source, scenario);

  const issues: ValidationIssue[] = [];

  if (!isInterpretationReliable(records)) {
    issues.push({
      severity: "warning",
      message:
        "Layout verify: gauge positions could not be fully resolved statically — overlap check skipped",
    });
    return issues;
  }

  if (skippedTextCount > 0) {
    issues.push({
      severity: "warning",
      message: `Layout verify: ${skippedTextCount} drawText call(s) could not be evaluated statically`,
    });
  }
  for (const w of warnings.slice(0, 3)) {
    issues.push({ severity: "warning", message: `Layout verify: ${w}` });
  }

  const hits = findOverlaps(records, { lcdW: options.lcdW, lcdH: options.lcdH });
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
  scenario: LayoutScenario = DEFAULT_LAYOUT_SCENARIO
): boolean {
  const { records } = interpretWidgetLayout(source, scenario);
  if (!isInterpretationReliable(records)) return true;
  return findOverlaps(records).length === 0;
}
