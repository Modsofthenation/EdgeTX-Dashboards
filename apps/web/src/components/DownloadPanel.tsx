"use client";

import type { TelemetryProtocol, ValidationIssue } from "@widget-gen/shared";
import styles from "./DownloadPanel.module.css";

interface DownloadPanelProps {
  widgetName: string | null;
  sessionId: string | null;
  protocol: TelemetryProtocol;
  validated: boolean;
  validationIssues: ValidationIssue[];
}

export function DownloadPanel({
  widgetName,
  sessionId,
  protocol,
  validated,
  validationIssues,
}: DownloadPanelProps) {
  const downloadUrl =
    validated && sessionId && widgetName
      ? `/api/download?sessionId=${encodeURIComponent(sessionId)}&protocol=${encodeURIComponent(protocol)}`
      : validated && widgetName
        ? `/api/download?name=${encodeURIComponent(widgetName)}&protocol=${encodeURIComponent(protocol)}`
        : null;

  const errors = validationIssues.filter((i) => i.severity === "error");

  return (
    <div className={styles.panel}>
      <h2 className={styles.title}>Download</h2>

      {!widgetName ? (
        <p className={styles.muted}>Complete generation to download your widget zip.</p>
      ) : !validated ? (
        <>
          <p className={styles.warn}>
            Widget <strong>{widgetName}</strong> was generated but did not pass validation.
            Download is blocked until all errors are fixed.
          </p>
          {errors.length > 0 && (
            <ul className={styles.validationList}>
              {errors.map((issue, i) => (
                <li key={i}>{issue.message}</li>
              ))}
            </ul>
          )}
          <p className={styles.muted}>
            Use <strong>Refine</strong> to ask the agent to fix validation errors, or edit the Lua
            source manually.
          </p>
        </>
      ) : (
        <>
          <p className={styles.info}>
            Widget <strong>{widgetName}</strong> passed validation and is ready for{" "}
            <code>WIDGETS/{widgetName}/main.lua</code>
          </p>
          {downloadUrl && (
            <a className={styles.button} href={downloadUrl} download={`${widgetName}.zip`}>
              Download {widgetName}.zip
            </a>
          )}
          <ul className={styles.steps}>
            <li>Extract zip to radio SD card</li>
            <li>Discover telemetry sensors on TELEMETRY page</li>
            <li>Add widget to main view → Full screen</li>
            <li>See INSTALL.md inside the zip for details</li>
          </ul>
        </>
      )}
    </div>
  );
}
