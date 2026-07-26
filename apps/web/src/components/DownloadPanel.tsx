"use client";

import { useState } from "react";
import type { TelemetryProtocol, ValidationIssue } from "@widget-gen/shared";
import { saveBlobToDisk } from "~/lib/desktopDownload";
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
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const canDownload = validated && !!widgetName;
  const errors = validationIssues.filter((i) => i.severity === "error");

  const buildDownloadUrl = () => {
    const params = new URLSearchParams({ protocol });
    if (sessionId) {
      params.set("sessionId", sessionId);
    } else if (widgetName) {
      params.set("name", widgetName);
    }
    return `/api/download?${params}`;
  };

  const handleDownload = async () => {
    if (!canDownload || !widgetName) return;

    setDownloading(true);
    setDownloadError(null);

    try {
      const res = await fetch(buildDownloadUrl());
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          validation?: { issues?: ValidationIssue[] };
        };
        const detail = body.error ?? `Download failed (${res.status})`;
        setDownloadError(detail);
        return;
      }

      const blob = await res.blob();
      const saved = await saveBlobToDisk(blob, `${widgetName}.zip`, {
        title: "Save widget zip",
        filters: [{ name: "Zip archive", extensions: ["zip"] }],
      });
      if (!saved.ok && "error" in saved) {
        setDownloadError(saved.error);
      }
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={styles.panel}>
      <h2 className={styles.title}>Download</h2>

      {!widgetName ? (
        <p className={styles.muted}>
          Complete generation to download your widget zip.
        </p>
      ) : !validated ? (
        <>
          <p className={styles.warn}>
            Widget <strong>{widgetName}</strong> was generated but did not pass
            validation. Download is blocked until all errors are fixed.
          </p>
          {errors.length > 0 && (
            <ul className={styles.validationList}>
              {errors.map((issue, i) => (
                <li key={i}>{issue.message}</li>
              ))}
            </ul>
          )}
          <p className={styles.muted}>
            Use <strong>Refine</strong> to ask the agent to fix validation
            errors, or edit the Lua source manually.
          </p>
        </>
      ) : (
        <>
          <p className={styles.info}>
            Widget <strong>{widgetName}</strong> passed validation and is ready
            for <code>WIDGETS/{widgetName}/main.lua</code>
          </p>
          <button
            type="button"
            className={styles.button}
            onClick={() => void handleDownload()}
            disabled={downloading}
          >
            {downloading ? "Preparing zip…" : `Download ${widgetName}.zip`}
          </button>
          {downloadError && <p className={styles.warn}>{downloadError}</p>}
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
