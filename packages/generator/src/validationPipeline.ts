import type { TelemetryProtocol, ValidationResult } from "@widget-gen/shared";
import { buildReleaseValidationContext } from "./validationContext.ts";
import { defaultWorkspace } from "./workspace.ts";
import { validateWidgetLua } from "./validate.ts";

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
  layoutArchetype?: import("./layoutArchetype.ts").LayoutArchetypeId;
  /** User prompt for intent↔sensor coverage checks. */
  userPrompt?: string;
  strictIntent?: boolean;
}

/** Pure validation on source string (no I/O). */
export function validateWidgetSource(
  source: string,
  protocol: TelemetryProtocol,
  options?: {
    radioId?: string;
    strictTelemetry?: boolean;
    userPrompt?: string;
    strictIntent?: boolean;
  },
): ValidationResult {
  const ctx = buildReleaseValidationContext(
    protocol,
    options?.radioId ?? "tx15",
    options?.strictTelemetry ?? true,
  );
  return validateWidgetLua(source, {
    ...ctx.validateOptions,
    userPrompt: options?.userPrompt,
    strictIntent: options?.strictIntent,
  });
}

/**
 * Full validation pipeline before download/packaging.
 * Workspace adapter handles read/annotate/auto-fix; validator stays pure.
 */
export function validateWidgetForRelease(
  workspaceKey: string,
  protocol: TelemetryProtocol,
  options?: ValidateForReleaseOptions,
): ValidationResult {
  const radioId = options?.radioId ?? "tx15";
  const workspace = options?.workspace ?? defaultWorkspace;
  const ctx = buildReleaseValidationContext(
    protocol,
    radioId,
    options?.strictTelemetry ?? true,
    options?.layoutArchetype,
  );

  if (!workspace.exists(workspaceKey)) {
    return {
      valid: false,
      issues: [
        {
          severity: "error",
          message: `Widget source not found: ${workspaceKey}`,
        },
      ],
    };
  }

  const prepared =
    options?.ensureAnnotations === false
      ? workspace.readSource(workspaceKey)
      : workspace.prepareForRadio(workspaceKey, radioId);

  if (!prepared.ok) {
    return {
      valid: false,
      issues: [{ severity: "error", message: prepared.message }],
    };
  }

  const result = validateWidgetLua(prepared.source, {
    ...ctx.validateOptions,
    userPrompt: options?.userPrompt,
    strictIntent: options?.strictIntent,
  });

  if (prepared.ok && prepared.autoFixes?.length) {
    return { ...result, autoFixes: prepared.autoFixes };
  }
  return result;
}

export function assertValidForRelease(
  workspaceKey: string,
  protocol: TelemetryProtocol,
  options?: ValidateForReleaseOptions,
): ValidationResult {
  const result = validateWidgetForRelease(workspaceKey, protocol, options);
  if (!result.valid) {
    throw new WidgetValidationError(result);
  }
  return result;
}
