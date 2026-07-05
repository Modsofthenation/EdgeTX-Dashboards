import type { TelemetryProtocol, ValidationResult } from "@widget-gen/shared";
import { buildReleaseValidationContext } from "./validationContext.js";
import { defaultWorkspace } from "./workspace.js";
import { validateWidgetLua } from "./validate.js";

export class WidgetValidationError extends Error {
  readonly result: ValidationResult;

  constructor(result: ValidationResult) {
    const summary = result.issues
      .filter((i) => i.severity === "error")
      .map((i) => i.message)
      .join("; ");
    super(`Widget validation failed: ${summary}`);
    this.name = "WidgetValidationError";
    this.result = result;
  }
}

export interface ValidateForReleaseOptions {
  radioId?: string;
  strictTelemetry?: boolean;
  /** When true (default), inject ---@type / ---@simulate via workspace before validating. */
  ensureAnnotations?: boolean;
  workspace?: typeof defaultWorkspace;
  layoutArchetype?: import("./layoutArchetype.js").LayoutArchetypeId;
}

/** Pure validation on source string (no I/O). */
export function validateWidgetSource(
  source: string,
  protocol: TelemetryProtocol,
  options?: { radioId?: string; strictTelemetry?: boolean }
): ValidationResult {
  const ctx = buildReleaseValidationContext(
    protocol,
    options?.radioId ?? "tx15",
    options?.strictTelemetry ?? true
  );
  return validateWidgetLua(source, ctx.validateOptions);
}

/**
 * Full validation pipeline before download/packaging.
 * Workspace adapter handles read/annotate; validator stays pure.
 */
export function validateWidgetForRelease(
  widgetName: string,
  protocol: TelemetryProtocol,
  options?: ValidateForReleaseOptions
): ValidationResult {
  const radioId = options?.radioId ?? "tx15";
  const workspace = options?.workspace ?? defaultWorkspace;
  const ctx = buildReleaseValidationContext(
    protocol,
    radioId,
    options?.strictTelemetry ?? true,
    options?.layoutArchetype
  );

  if (!workspace.exists(widgetName)) {
    return {
      valid: false,
      issues: [{ severity: "error", message: `Widget source not found: ${widgetName}` }],
    };
  }

  const prepared =
    options?.ensureAnnotations === false
      ? workspace.readSource(widgetName)
      : workspace.prepareForRadio(widgetName, radioId);

  if (!prepared.ok) {
    return { valid: false, issues: [{ severity: "error", message: prepared.message }] };
  }

  return validateWidgetLua(prepared.source, ctx.validateOptions);
}

export function assertValidForRelease(
  widgetName: string,
  protocol: TelemetryProtocol,
  options?: ValidateForReleaseOptions
): ValidationResult {
  const result = validateWidgetForRelease(widgetName, protocol, options);
  if (!result.valid) {
    throw new WidgetValidationError(result);
  }
  return result;
}
