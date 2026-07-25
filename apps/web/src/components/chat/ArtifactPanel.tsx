"use client";

import { memo, useState } from "react";
import Link from "next/link";
import type { TelemetryProtocol } from "@widget-gen/shared";
import type { WidgetSnapshot, WidgetVersionEntry } from "~/lib/chatTypes";
import { Preview480x320 } from "../Preview480x320";
import { InstallGuidePanel } from "../InstallGuidePanel";
import { PanelCollapseButton } from "./CollapsibleAside";
import { ArtifactVersionSelect } from "./ArtifactVersionSelect";
import styles from "./ArtifactPanel.module.css";

function InstallGuideInline({
  protocol,
  widgetName,
}: {
  protocol: TelemetryProtocol;
  widgetName: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.installWrap}>
      <button
        type="button"
        className={styles.installToggle}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? "Hide install guide" : "Install on radio"}
      </button>
      {open ? (
        <div className={styles.installBody}>
          <InstallGuidePanel protocol={protocol} widgetName={widgetName} />
        </div>
      ) : null}
    </div>
  );
}

interface ArtifactPanelProps {
  chatId: string | null;
  artifact: WidgetSnapshot | null;
  artifactVersions: WidgetVersionEntry[];
  viewingVersion: number;
  latestVersion: number;
  onSelectVersion: (version: number) => void;
  sessionId: string | null;
  protocol: TelemetryProtocol;
  running: boolean;
  artifactLoading?: boolean;
  layoutProfileId?: string;
  radioName?: string | null;
  edgeTxVersion?: string;
  panelCollapsed?: boolean;
  onTogglePanel?: () => void;
}

export const ArtifactPanel = memo(function ArtifactPanel({
  chatId,
  artifact,
  artifactVersions,
  viewingVersion,
  latestVersion,
  onSelectVersion,
  sessionId,
  protocol,
  running,
  artifactLoading = false,
  layoutProfileId = "tx15",
  radioName,
  edgeTxVersion = "2.11.0",
  panelCollapsed = false,
  onTogglePanel,
}: ArtifactPanelProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const showPreviewLoader = running || artifactLoading;
  const hasPreview = !!artifact?.luaSource;
  const previewKey = `${chatId ?? "new"}-${artifact?.instanceId ?? artifact?.name ?? "empty"}-v${viewingVersion}`;
  const isViewingLatest = viewingVersion === latestVersion;

  const errors =
    artifact?.validationIssues.filter((i) => i.severity === "error") ?? [];

  const handleDownload = async () => {
    if (!artifact?.validated) return;
    setDownloading(true);
    setDownloadError(null);

    try {
      const params = new URLSearchParams({ protocol });
      if (sessionId) params.set("sessionId", sessionId);
      else if (artifact.instanceId)
        params.set("instanceId", artifact.instanceId);
      else params.set("name", artifact.name);
      if (!isViewingLatest) params.set("version", String(viewingVersion));

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
      anchor.download = `${artifact.name}${isViewingLatest ? "" : `-v${viewingVersion}`}.zip`;
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
            <PanelCollapseButton
              label="Dashboard"
              collapsed={panelCollapsed}
              onToggle={onTogglePanel}
              side="right"
            />
          )}
          <div className={styles.headerText}>
            <span className={styles.label}>Dashboard</span>
            <h2 className={styles.name}>{artifact?.name ?? "Output"}</h2>
          </div>
        </div>
        {artifact && (
          <span
            className={artifact.validated ? styles.badgeOk : styles.badgeWarn}
          >
            {artifact.validated
              ? "Ready"
              : running
                ? "Building"
                : "Needs fixes"}
          </span>
        )}
      </div>

      {artifact && artifactVersions.length > 1 && (
        <ArtifactVersionSelect
          versions={artifactVersions}
          latestVersion={latestVersion}
          selectedVersion={viewingVersion}
          onSelectVersion={(v) => void onSelectVersion(v)}
          disabled={running || artifactLoading}
        />
      )}

      {!hasPreview && !showPreviewLoader ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden>
            ◫
          </span>
          <h3 className={styles.emptyTitle}>No dashboard yet</h3>
          <p className={styles.emptyText}>
            Your generated dashboard preview and download zip will appear here
            when the agent writes <code>main.lua</code>. Companion scripts
            (tools, loggers) are included in the zip with install steps in{" "}
            <code>INSTALL.md</code>.
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
              edgeTxVersion={edgeTxVersion}
              radioName={radioName}
              live={!showPreviewLoader}
              variant="compact"
            />
            {showPreviewLoader && (
              <div
                className={styles.previewOverlay}
                role="status"
                aria-live="polite"
              >
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

          {artifact && !artifact.validated && (
            <div className={styles.downloadGate}>
              <p className={styles.downloadGateTitle}>
                Download blocked until validation passes
              </p>
              {errors.length > 0 ? (
                <ul className={styles.errors}>
                  {errors.slice(0, 5).map((issue, i) => (
                    <li key={i}>{issue.message}</li>
                  ))}
                  {errors.length > 5 && (
                    <li>…and {errors.length - 5} more error(s)</li>
                  )}
                </ul>
              ) : (
                <p className={styles.downloadGateHint}>
                  Ask the assistant to fix validation issues, or open Edit
                  layout to adjust the source.
                </p>
              )}
            </div>
          )}

          {artifact && (
            <>
              <div className={styles.actions}>
                <Link
                  href={`/editor?${new URLSearchParams({
                    ...(sessionId ? { sessionId } : {}),
                    ...(artifact.instanceId
                      ? { instanceId: artifact.instanceId }
                      : { name: artifact.name }),
                    protocol,
                  }).toString()}`}
                  className={styles.editLayoutBtn}
                >
                  Edit layout
                </Link>
                <button
                  type="button"
                  className={styles.downloadBtn}
                  disabled={
                    !artifact.validated || downloading || showPreviewLoader
                  }
                  title={
                    !artifact.validated
                      ? "Fix validation errors before downloading"
                      : undefined
                  }
                  onClick={() => void handleDownload()}
                >
                  {downloading
                    ? "Preparing zip…"
                    : `Download ${artifact.name}${isViewingLatest ? "" : ` v${viewingVersion}`}.zip`}
                </button>
              </div>
              {downloadError && (
                <p className={styles.downloadError}>{downloadError}</p>
              )}
              <p className={styles.hint}>
                Extract to <code>WIDGETS/{artifact.name}/</code> on your radio
                SD card. INSTALL.md is inside the zip.
              </p>
              <InstallGuideInline
                protocol={protocol}
                widgetName={artifact.name}
              />
            </>
          )}
        </>
      )}
    </aside>
  );
});
