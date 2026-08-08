"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { TelemetryProtocol } from "@widget-gen/shared";
import { getSimulateLayoutProfile } from "@widget-gen/shared";
import type { WidgetSnapshot, WidgetVersionEntry } from "~/lib/chatTypes";
import {
  buildInstallGuide,
  formatInstallGuideMarkdown,
} from "~/lib/installGuide";
import {
  isWebSerialSupported,
  openLiveTelemetryPort,
  type LiveSensorMap,
  type LiveTelemetryHandle,
} from "~/lib/liveTelemetryBridge";
import { Preview480x320 } from "../Preview480x320";
import { InstallGuidePanel } from "../InstallGuidePanel";
import { InstallWizard } from "../InstallWizard";
import {
  parseDownloadValidationFailure,
  ValidationFailureDialog,
  type DownloadValidationFailure,
} from "../ValidationFailureDialog";
import { RefineDiffPanel } from "./RefineDiffPanel";
import { RadioFeedbackPanel } from "./RadioFeedbackPanel";
import { PanelCollapseButton } from "./CollapsibleAside";
import { ArtifactVersionSelect } from "./ArtifactVersionSelect";
import styles from "./ArtifactPanel.module.css";
import { useChatSession } from "~/lib/useWidgetChat";
import type { PendingPromptImage } from "~/lib/promptImages";
import { buildBlankEditorHref, buildEditorHref } from "~/lib/editorHref";
import { saveBlobToDisk } from "~/lib/desktopDownload";

const LIVE_ENRICH_STORAGE_KEY = "edgetx.liveEnrich.v1";

function readEnrichRotorflightPreference(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(LIVE_ENRICH_STORAGE_KEY);
    if (raw == null) return true;
    return raw !== "0" && raw !== "false";
  } catch {
    return true;
  }
}

function writeEnrichRotorflightPreference(enabled: boolean): void {
  try {
    localStorage.setItem(LIVE_ENRICH_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function InstallGuideInline({
  protocol,
  widgetName,
  radioName,
  lcdW,
  lcdH,
}: {
  protocol: TelemetryProtocol;
  widgetName: string;
  radioName?: string | null;
  lcdW?: number;
  lcdH?: number;
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
          <InstallGuidePanel
            protocol={protocol}
            widgetName={widgetName}
            radioName={radioName}
            lcdW={lcdW}
            lcdH={lcdH}
          />
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
  radioId?: string;
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
  radioId,
  radioName,
  edgeTxVersion = "2.11.0",
  panelCollapsed = false,
  onTogglePanel,
}: ArtifactPanelProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [validationFailure, setValidationFailure] =
    useState<DownloadValidationFailure | null>(null);
  const [liveRadioActive, setLiveRadioActive] = useState(false);
  const [liveSensors, setLiveSensors] = useState<LiveSensorMap | null>(null);
  const [liveWireKeys, setLiveWireKeys] = useState<string[]>([]);
  const [liveEnrichKeys, setLiveEnrichKeys] = useState<string[]>([]);
  const [liveNote, setLiveNote] = useState<string | null>(null);
  const [enrichRotorflight, setEnrichRotorflight] = useState(
    readEnrichRotorflightPreference,
  );
  const liveHandleRef = useRef<LiveTelemetryHandle | null>(null);
  const liveSupported =
    typeof window !== "undefined" ? isWebSerialSupported() : false;
  const { sendMessage, running: chatRunning, canRefine } = useChatSession();

  const showPreviewLoader = running || artifactLoading;
  const installMd = useMemo(() => {
    if (!artifact?.name) return null;
    const profile = getSimulateLayoutProfile(layoutProfileId);
    return formatInstallGuideMarkdown(
      buildInstallGuide(protocol, artifact.name, {
        radioName: radioName ?? undefined,
        lcdW: profile.lcdW,
        lcdH: profile.lcdH,
      }),
    );
  }, [artifact?.name, protocol, radioName, layoutProfileId]);

  const handleEnrichChange = useCallback(
    (enabled: boolean) => {
      setEnrichRotorflight(enabled);
      writeEnrichRotorflightPreference(enabled);
      liveHandleRef.current?.setEnrichRotorflight(enabled);
      if (liveRadioActive && protocol === "rotorflight") {
        setLiveNote(
          enabled
            ? "Live · enrich ON — HSpd/Gov/Vbec may be preview-filled"
            : "Live · enrich OFF — wire CRSF sensors only",
        );
      }
    },
    [liveRadioActive, protocol],
  );

  const toggleLiveRadio = useCallback(async () => {
    if (liveRadioActive) {
      await liveHandleRef.current?.close();
      liveHandleRef.current = null;
      setLiveRadioActive(false);
      setLiveSensors(null);
      setLiveWireKeys([]);
      setLiveEnrichKeys([]);
      setLiveNote(null);
      return;
    }
    try {
      const handle = await openLiveTelemetryPort(
        (values, meta) => {
          setLiveSensors(values);
          // discoveredSensors = wire only; enrichKeys tracked separately
          const wireKeys = meta?.wireKeys ?? Object.keys(values);
          const enrichKeys = meta?.enrichKeys ?? [];
          setLiveWireKeys(wireKeys);
          setLiveEnrichKeys(enrichKeys);
          setLiveNote(
            wireKeys.length
              ? `Live · ${wireKeys.slice(0, 5).join(", ")}${wireKeys.length > 5 ? "…" : ""}${
                  enrichKeys.length
                    ? ` · preview fill: ${enrichKeys.slice(0, 3).join(", ")}${enrichKeys.length > 3 ? "…" : ""}`
                    : ""
                }`
              : "Live · waiting for CRSF",
          );
        },
        { enrichRotorflight },
      );
      liveHandleRef.current = handle;
      setLiveRadioActive(true);
      setLiveNote(
        protocol === "rotorflight"
          ? enrichRotorflight
            ? "Live · CRSF on wire; enrich ON — HSpd/Gov/Vbec may be preview-filled (not true FC sensors until rf2bg)"
            : "Live · CRSF on wire; enrich OFF — wire sensors only"
          : "Live · waiting for CRSF",
      );
    } catch (err) {
      setLiveNote(
        err instanceof Error ? err.message : "Failed to open serial port",
      );
    }
  }, [liveRadioActive, protocol, enrichRotorflight]);

  useEffect(() => {
    return () => {
      void liveHandleRef.current?.close();
    };
  }, []);
  const hasPreview = !!artifact?.luaSource;
  const previewKey = `${chatId ?? "new"}-${artifact?.instanceId ?? artifact?.name ?? "empty"}-v${viewingVersion}`;
  const isViewingLatest = viewingVersion === latestVersion;

  const errors =
    artifact?.validationIssues.filter((i) => i.severity === "error") ?? [];

  const handleDownload = async () => {
    if (!artifact?.validated) return;
    setDownloading(true);
    setDownloadError(null);
    setValidationFailure(null);

    try {
      const params = new URLSearchParams({ protocol });
      if (radioId) params.set("radioId", radioId);
      if (artifact.instanceId) params.set("instanceId", artifact.instanceId);
      else if (sessionId) params.set("sessionId", sessionId);
      else params.set("name", artifact.name);
      if (!isViewingLatest) params.set("version", String(viewingVersion));

      const res = await fetch(`/api/download?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 422) {
          setValidationFailure(
            parseDownloadValidationFailure(body, res.status),
          );
          return;
        }
        const errBody = body as { error?: string; message?: string };
        setDownloadError(
          errBody.message ?? errBody.error ?? `Download failed (${res.status})`,
        );
        return;
      }

      const blob = await res.blob();
      const fileName = `${artifact.name}${isViewingLatest ? "" : `-v${viewingVersion}`}.zip`;
      const saved = await saveBlobToDisk(blob, fileName, {
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
    <aside className={styles.panel}>
      <ValidationFailureDialog
        open={validationFailure != null}
        failure={validationFailure}
        onClose={() => setValidationFailure(null)}
      />
      <div className={styles.header}>
        <div className={styles.headerMain}>
          {onTogglePanel && (
            <PanelCollapseButton
              label="Preview"
              collapsed={panelCollapsed}
              onToggle={onTogglePanel}
              side="right"
            />
          )}
          <div className={styles.headerText}>
            <span className={styles.label}>Preview</span>
            <h2 className={styles.name}>{artifact?.name ?? "No widget yet"}</h2>
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

      {(() => {
        const previous = artifactVersions
          .filter((v) => v.version < viewingVersion && v.luaSource)
          .sort((a, b) => b.version - a.version)[0];
        const currentLua =
          artifact?.luaSource ??
          artifactVersions.find((v) => v.version === viewingVersion)?.luaSource;
        if (!previous?.luaSource || !currentLua) return null;
        return (
          <RefineDiffPanel
            previousLua={previous.luaSource}
            currentLua={currentLua}
            previousLabel={`v${previous.version}`}
            currentLabel={`v${viewingVersion}`}
            layoutProfileId={layoutProfileId}
          />
        );
      })()}

      {!hasPreview && !showPreviewLoader ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden>
            ◫
          </span>
          <h3 className={styles.emptyTitle}>No preview yet</h3>
          <p className={styles.emptyText}>
            Describe a dashboard in chat, or{" "}
            <Link
              href={buildBlankEditorHref({
                protocol,
                radioId,
                layoutProfileId,
                chatId,
                edgeTxVersion,
              })}
              className={styles.emptyLink}
            >
              open Layout
            </Link>{" "}
            to build one by hand (Insert / prefabs — no AI). When{" "}
            <code>main.lua</code> is ready, preview and download show up here.
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
              radioId={radioId ?? layoutProfileId}
              edgeTxVersion={edgeTxVersion}
              radioName={radioName}
              live={!showPreviewLoader && !liveRadioActive}
              liveSensors={liveRadioActive ? liveSensors : null}
              variant="compact"
              toolbarExtra={
                <>
                  <button
                    type="button"
                    className={styles.liveRadioBtn}
                    disabled={!liveSupported && !liveRadioActive}
                    title={
                      liveSupported
                        ? "Stream CRSF/ELRS into this preview"
                        : "Web Serial requires Chrome/Edge"
                    }
                    onClick={() => void toggleLiveRadio()}
                  >
                    {liveRadioActive ? "Live: on" : "Live radio"}
                  </button>
                  {protocol === "rotorflight" ? (
                    <label
                      className={styles.enrichCheck}
                      title="Fill missing HSpd/Gov/Vbec from CRSF heuristics while live"
                    >
                      <input
                        type="checkbox"
                        checked={enrichRotorflight}
                        onChange={(e) => handleEnrichChange(e.target.checked)}
                      />
                      Enrich RF
                    </label>
                  ) : null}
                </>
              }
            />
            {liveNote ? (
              <p className={styles.liveRadioNote} role="status">
                {liveNote}
              </p>
            ) : null}
            {liveRadioActive && protocol === "rotorflight" ? (
              <p className={styles.liveRadioNote} role="note">
                Enrich {enrichRotorflight ? "ON" : "OFF"} —{" "}
                {enrichRotorflight
                  ? `wire: ${liveWireKeys.length ? liveWireKeys.slice(0, 4).join(", ") : "none"}; preview fill: ${liveEnrichKeys.length ? liveEnrichKeys.join(", ") : "none"} — enable rf2bg + Discover new for true radio sensors.`
                  : "showing sensors present on the wire only."}
              </p>
            ) : null}
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
                  Ask the assistant to fix validation issues, or open Layout to
                  adjust the source.
                </p>
              )}
            </div>
          )}

          {artifact && (
            <>
              <div className={styles.workflow} aria-label="Next steps">
                <span className={styles.workflowStep} data-done="true">
                  Preview
                </span>
                <span className={styles.workflowSep} aria-hidden>
                  →
                </span>
                <span className={styles.workflowStep}>Layout</span>
                <span className={styles.workflowSep} aria-hidden>
                  →
                </span>
                <span
                  className={styles.workflowStep}
                  data-done={artifact.validated ? "true" : undefined}
                >
                  Download
                </span>
              </div>
              <div className={styles.actions}>
                <Link
                  href={buildEditorHref({
                    protocol,
                    chatId,
                    sessionId,
                    instanceId: artifact.instanceId,
                    name: artifact.name,
                    layoutProfileId,
                    radioId: radioId ?? layoutProfileId,
                    edgeTxVersion,
                  })}
                  className={styles.editLayoutBtn}
                >
                  Open Layout
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
                radioName={radioName}
                lcdW={getSimulateLayoutProfile(layoutProfileId)?.lcdW}
                lcdH={getSimulateLayoutProfile(layoutProfileId)?.lcdH}
              />
              <div className={styles.installWrap}>
                <InstallWizard
                  widgetName={artifact.name}
                  luaSource={artifact.luaSource}
                  installMd={installMd}
                  workspaceKey={artifact.instanceId ?? null}
                  sessionId={sessionId}
                  protocol={protocol}
                  radioId={radioId ?? null}
                  companionLabels={[]}
                  hasModelImage={/drawBitmap|Bitmap\.open|\/IMAGES\//.test(
                    artifact.luaSource ?? "",
                  )}
                />
              </div>
              {canRefine ? (
                <RadioFeedbackPanel
                  disabled={chatRunning || running}
                  onSubmit={(prompt, images?: PendingPromptImage[]) => {
                    void sendMessage(prompt, images ? { images } : undefined);
                  }}
                />
              ) : null}
            </>
          )}
        </>
      )}
    </aside>
  );
});
