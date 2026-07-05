"use client";

import { useState } from "react";
import type { TelemetryProtocol } from "@widget-gen/shared";
import type { WidgetSnapshot } from "@/lib/chatTypes";
import { Preview480x320 } from "../Preview480x320";
import { PanelCollapseButton } from "./CollapsibleAside";
import styles from "./ArtifactPanel.module.css";

interface ArtifactPanelProps {
  chatId: string | null;
  artifact: WidgetSnapshot | null;
  sessionId: string | null;
  protocol: TelemetryProtocol;
  running: boolean;
  artifactLoading?: boolean;
  layoutProfileId?: string;
  radioName?: string | null;
  panelCollapsed?: boolean;
  onTogglePanel?: () => void;
}

export function ArtifactPanel({
  chatId,
  artifact,
  sessionId,
  protocol,
  running,
  artifactLoading = false,
  layoutProfileId = "tx15",
  radioName,
  panelCollapsed = false,
  onTogglePanel,
}: ArtifactPanelProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const showPreviewLoader = running || artifactLoading;
  const hasPreview = !!artifact?.luaSource;
  const previewKey = `${chatId ?? "new"}-${artifact?.instanceId ?? artifact?.name ?? "empty"}-v${artifact?.version ?? 0}`;

  const errors = artifact?.validationIssues.filter((i) => i.severity === "error") ?? [];

  const handleDownload = async () => {
    if (!artifact?.validated) return;
    setDownloading(true);
    setDownloadError(null);

    try {
      const params = new URLSearchParams({ protocol });
      if (sessionId) params.set("sessionId", sessionId);
      else if (artifact.instanceId) params.set("instanceId", artifact.instanceId);
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
        <div className={styles.headerMain}>
          {onTogglePanel && (
            <PanelCollapseButton label="Dashboard" collapsed={panelCollapsed} onToggle={onTogglePanel} side="right" />
          )}
          <div className={styles.headerText}>
            <span className={styles.label}>Dashboard</span>
            <h2 className={styles.name}>{artifact?.name ?? "Output"}</h2>
          </div>
        </div>
        {artifact && (
          <span className={artifact.validated ? styles.badgeOk : styles.badgeWarn}>
            {artifact.validated ? "Ready" : running ? "Building" : "Needs fixes"}
          </span>
        )}
      </div>

      {!hasPreview && !showPreviewLoader ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden>
            ◫
          </span>
          <h3 className={styles.emptyTitle}>No dashboard yet</h3>
          <p className={styles.emptyText}>
            Your generated dashboard preview and download zip will appear here when the agent writes{" "}
            <code>main.lua</code>. Companion scripts (tools, loggers) are included in the zip with
            install steps in <code>INSTALL.md</code>.
          </p>
        </div>
      ) : (
        <>
          <div className={styles.previewSection}>
            <Preview480x320
              key={previewKey}
              luaSource={artifact?.luaSource ?? null}
              widgetName={artifact?.name ?? null}
              layoutProfileId={layoutProfileId}
              radioName={radioName}
              live={!showPreviewLoader}
              variant="compact"
            />
            {showPreviewLoader && (
              <div className={styles.previewOverlay} role="status" aria-live="polite">
                <span className={styles.spinner} aria-hidden />
                <p className={styles.overlayTitle}>
                  {running ? "Generating dashboard…" : "Loading preview…"}
                </p>
                <p className={styles.overlayHint}>
                  {running
                    ? "Preview updates when the Lua file is saved."
                    : "Fetching widget source for this chat."}
                </p>
              </div>
            )}
          </div>

          {artifact && !artifact.validated && errors.length > 0 && (
            <ul className={styles.errors}>
              {errors.slice(0, 5).map((issue, i) => (
                <li key={i}>{issue.message}</li>
              ))}
            </ul>
          )}

          {artifact && (
            <>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.downloadBtn}
                  disabled={!artifact.validated || downloading || showPreviewLoader}
                  onClick={() => void handleDownload()}
                >
                  {downloading ? "Preparing zip…" : `Download ${artifact.name}.zip`}
                </button>
              </div>
              {downloadError && <p className={styles.downloadError}>{downloadError}</p>}
              <p className={styles.hint}>
                Extract to <code>WIDGETS/{artifact.name}/</code> on your radio SD card. INSTALL.md is
                inside the zip.
              </p>
            </>
          )}
        </>
      )}
    </aside>
  );
}
