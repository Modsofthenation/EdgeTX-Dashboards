"use client";

import { useState } from "react";
import type { TelemetryProtocol } from "@widget-gen/shared";
import type { WidgetSnapshot } from "@/lib/chatTypes";
import { Preview480x320 } from "../Preview480x320";
import styles from "./ArtifactPanel.module.css";

interface ArtifactPanelProps {
  artifact: WidgetSnapshot | null;
  sessionId: string | null;
  protocol: TelemetryProtocol;
  running: boolean;
  layoutProfileId?: string;
  radioName?: string | null;
}

export function ArtifactPanel({
  artifact,
  sessionId,
  protocol,
  running,
  layoutProfileId = "tx15",
  radioName,
}: ArtifactPanelProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  if (!artifact?.luaSource && !running) {
    return (
      <aside className={styles.panel}>
        <div className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden>
            ◫
          </span>
          <h2 className={styles.emptyTitle}>Widget output</h2>
          <p className={styles.emptyText}>
            Your generated widget preview and download will appear here when the agent writes{" "}
            <code>main.lua</code>.
          </p>
        </div>
      </aside>
    );
  }

  if (!artifact?.luaSource && running) {
    return (
      <aside className={styles.panel}>
        <div className={styles.empty}>
          <span className={styles.loading} aria-hidden />
          <h2 className={styles.emptyTitle}>Generating widget…</h2>
          <p className={styles.emptyText}>Preview will appear as soon as the agent saves the Lua file.</p>
        </div>
      </aside>
    );
  }

  if (!artifact) return null;

  const errors = artifact.validationIssues.filter((i) => i.severity === "error");

  const handleDownload = async () => {
    if (!artifact.validated) return;
    setDownloading(true);
    setDownloadError(null);

    try {
      const params = new URLSearchParams({ protocol });
      if (sessionId) params.set("sessionId", sessionId);
      else params.set("name", artifact.name);

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
      anchor.download = `${artifact.name}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <div>
          <span className={styles.label}>Artifact</span>
          <h2 className={styles.name}>{artifact.name}</h2>
        </div>
        <span className={artifact.validated ? styles.badgeOk : styles.badgeWarn}>
          {artifact.validated ? "Ready" : running ? "Building" : "Needs fixes"}
        </span>
      </div>

      <Preview480x320
        luaSource={artifact.luaSource}
        widgetName={artifact.name}
        layoutProfileId={layoutProfileId}
        radioName={radioName}
        live
        variant="compact"
      />

      {!artifact.validated && errors.length > 0 && (
        <ul className={styles.errors}>
          {errors.slice(0, 5).map((issue, i) => (
            <li key={i}>{issue.message}</li>
          ))}
        </ul>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.downloadBtn}
          disabled={!artifact.validated || downloading}
          onClick={() => void handleDownload()}
        >
          {downloading ? "Preparing zip…" : `Download ${artifact.name}.zip`}
        </button>
      </div>
      {downloadError && <p className={styles.downloadError}>{downloadError}</p>}

      <p className={styles.hint}>
        Extract to <code>WIDGETS/{artifact.name}/</code> on your radio SD card. INSTALL.md is inside
        the zip.
      </p>
    </aside>
  );
}
