"use client";

import { useState } from "react";
import type { TelemetryProtocol } from "@widget-gen/shared";
import type { WidgetSnapshot } from "@/lib/chatTypes";
import { Preview480x320 } from "../Preview480x320";
import styles from "./WidgetPreviewCard.module.css";

interface WidgetPreviewCardProps {
  widget: WidgetSnapshot;
  sessionId: string | null;
  protocol: TelemetryProtocol;
}

export function WidgetPreviewCard({ widget, sessionId, protocol }: WidgetPreviewCardProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const errors = widget.validationIssues.filter((i) => i.severity === "error");

  const handleDownload = async () => {
    if (!widget.validated) return;
    setDownloading(true);
    setDownloadError(null);

    try {
      const params = new URLSearchParams({ protocol });
      if (sessionId) params.set("sessionId", sessionId);
      else params.set("name", widget.name);

      const res = await fetch(`/api/download?${params}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setDownloadError(body.error ?? `Download failed (${res.status})`);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${widget.name}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <span className={styles.label}>Widget</span>
          <h3 className={styles.name}>{widget.name}</h3>
        </div>
        <span className={widget.validated ? styles.badgeOk : styles.badgeWarn}>
          {widget.validated ? "Validated" : "Needs fixes"}
        </span>
      </div>

      {widget.luaSource && (
        <Preview480x320
          luaSource={widget.luaSource}
          widgetName={widget.name}
          live
          variant="compact"
        />
      )}

      {!widget.validated && errors.length > 0 && (
        <ul className={styles.errors}>
          {errors.slice(0, 4).map((issue, i) => (
            <li key={i}>{issue.message}</li>
          ))}
        </ul>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.downloadBtn}
          disabled={!widget.validated || downloading}
          onClick={() => void handleDownload()}
        >
          {downloading ? "Preparing…" : "Download zip"}
        </button>
        <span className={styles.hint}>WIDGETS/{widget.name}/main.lua</span>
      </div>
      {downloadError && <p className={styles.downloadError}>{downloadError}</p>}
    </div>
  );
}
