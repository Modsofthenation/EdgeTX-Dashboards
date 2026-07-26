export type DownloadValidationIssue = {
  severity: "error" | "warning" | string;
  message: string;
  line?: number | null;
};

export type DownloadValidationFailure = {
  title?: string;
  message: string;
  hint?: string;
  issues: DownloadValidationIssue[];
  protocol?: string;
  radioId?: string;
};

/** Parse a failed `/api/download` JSON body into dialog props. */
export function parseDownloadValidationFailure(
  body: unknown,
  fallbackStatus?: number,
): DownloadValidationFailure {
  const data = (body ?? {}) as {
    error?: string;
    message?: string;
    hint?: string;
    issues?: DownloadValidationIssue[];
    validationIssues?: DownloadValidationIssue[];
    validation?: { issues?: DownloadValidationIssue[] };
    protocol?: string;
    radioId?: string;
  };

  const issues =
    data.issues ??
    data.validationIssues ??
    data.validation?.issues ??
    [];

  return {
    title: "Download blocked",
    message:
      data.message ??
      data.error ??
      (fallbackStatus
        ? `Download failed (${fallbackStatus})`
        : "Widget failed validation"),
    hint:
      data.hint ??
      "Fix the errors in Layout (Validation / Properties), Save, then try again. Confirm the telemetry protocol and radio match the sensors in your Lua.",
    issues,
    protocol: data.protocol,
    radioId: data.radioId,
  };
}
