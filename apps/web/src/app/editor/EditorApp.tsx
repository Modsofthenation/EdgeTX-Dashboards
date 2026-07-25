"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  bindTextRecordToSensor,
  createStarterSource,
  interpretDocument,
  insertDrawLine,
  parseDocumentMeta,
  patchRecordArgs,
  patchWidgetName,
  removeRecordLine,
  resizeRecord,
  setRecordColor,
  setRecordText,
  translateRecord,
  type DocumentRecord,
  type TextFormat,
  type ZoneOffset,
} from "@widget-gen/editor-core";
import {
  getLastPreviewParseMeta,
  getPreviewScenario,
  isInterpretationReliable,
  parseLuaToDrawCommands,
  type EdgeColor,
} from "@widget-gen/layout-verify";
import type { TelemetryProtocol, ValidationIssue } from "@widget-gen/shared";
import {
  getSimulateLayoutProfile,
  resolvePreviewDimensions,
} from "@widget-gen/shared";
import { useRouter } from "next/navigation";
import { useSourceUndoStack } from "./hooks/useSourceUndoStack";
import { EditorCanvas } from "./components/EditorCanvas";
import { RecordLayersPanel } from "./components/RecordLayersPanel";
import { RecordPropertiesPanel } from "./components/RecordPropertiesPanel";
import { EditorToolbar } from "./components/EditorToolbar";
import { SimVerifyModal } from "./components/SimVerifyModal";
import type { InsertDrawKind } from "./elementMeta";
import styles from "./editor.module.css";

type MobileTab = "layers" | "canvas" | "properties";

const PROTOCOLS: TelemetryProtocol[] = [
  "betaflight",
  "rotorflight",
  "generic-crsf",
];

function parseProtocol(raw: string | null): TelemetryProtocol {
  if (raw && PROTOCOLS.includes(raw as TelemetryProtocol))
    return raw as TelemetryProtocol;
  return "betaflight";
}

export function EditorApp() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const instanceId = searchParams.get("instanceId");
  const widgetName = searchParams.get("name");
  const sid = searchParams.get("sessionId");
  const chatId = searchParams.get("chatId");
  const hasRemoteWidget = Boolean(instanceId || widgetName || sid);

  const [protocol, setProtocol] = useState<TelemetryProtocol>(() =>
    parseProtocol(searchParams.get("protocol")),
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [valid, setValid] = useState<boolean | null>(null);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>(
    [],
  );
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [copyDone, setCopyDone] = useState(false);
  const [workspaceKey, setWorkspaceKey] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [simOpen, setSimOpen] = useState(false);
  const [simReloadKey, setSimReloadKey] = useState(0);
  const [remoteLoadPending, setRemoteLoadPending] = useState(hasRemoteWidget);
  const [dirty, setDirty] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("canvas");
  const [previewScenarioId, setPreviewScenarioId] = useState("editor-preview");
  const loadRequestIdRef = useRef(0);
  const savedSourceRef = useRef<string | null>(null);

  const { source, setSource, replaceSource, undo, redo, canUndo, canRedo } =
    useSourceUndoStack(createStarterSource());

  const meta = useMemo(() => parseDocumentMeta(source), [source]);
  const previewScenario = useMemo(
    () => getPreviewScenario(previewScenarioId),
    [previewScenarioId],
  );
  const records = useMemo(
    () => interpretDocument(source, previewScenario),
    [source, previewScenario],
  );

  const previewMeta = useMemo(() => {
    const cmds = parseLuaToDrawCommands(source, previewScenario);
    const parseMeta = getLastPreviewParseMeta();
    return {
      skippedTextCount: parseMeta.skippedTextCount,
      unreliable: !isInterpretationReliable(cmds, parseMeta.skippedTextCount),
      warnings: parseMeta.warnings,
    };
  }, [source, previewScenario]);

  const zone = useMemo((): ZoneOffset => {
    const dims = resolvePreviewDimensions(
      source,
      getSimulateLayoutProfile("tx15"),
    );
    return {
      zoneX: dims.zoneX,
      zoneY: dims.zoneY,
      zoneW: dims.zoneW,
      zoneH: dims.zoneH,
    };
  }, [source]);

  const markDirty = useCallback(() => {
    setDirty(true);
    setValid(null);
  }, []);

  const loadFromSource = useCallback(
    (nextSource: string, markClean = false) => {
      replaceSource(nextSource);
      setSelectedIds([]);
      setValid(null);
      setValidationIssues([]);
      if (markClean) {
        savedSourceRef.current = nextSource;
        setDirty(false);
      } else {
        setDirty(true);
      }
    },
    [replaceSource],
  );

  useEffect(() => {
    setSessionId(sid);
    if (!instanceId && !widgetName && !sid) {
      setRemoteLoadPending(false);
      return;
    }

    setRemoteLoadPending(true);
    const requestId = ++loadRequestIdRef.current;
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (sid) params.set("sessionId", sid);
    if (instanceId) params.set("instanceId", instanceId);
    if (widgetName) params.set("name", widgetName);

    void fetch(`/api/widget-source?${params}`, { signal: controller.signal })
      .then(async (res) => {
        if (requestId !== loadRequestIdRef.current) return;
        if (!res.ok) {
          if (res.status === 204) throw new Error("Widget not found");
          throw new Error(`Load failed (${res.status})`);
        }
        const text = await res.text();
        const wk =
          res.headers.get("X-Widget-Instance-Id") ??
          instanceId ??
          widgetName ??
          sid ??
          "";
        setWorkspaceKey(wk);
        loadFromSource(text, true);
      })
      .catch((err: Error) => {
        if (controller.signal.aborted || requestId !== loadRequestIdRef.current)
          return;
        setLoadError(err.message);
      })
      .finally(() => {
        if (requestId === loadRequestIdRef.current) setRemoteLoadPending(false);
      });

    return () => controller.abort();
  }, [instanceId, widgetName, sid, loadFromSource]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const selectedRecords = useMemo(
    () => records.filter((r) => selectedIds.includes(r.id)),
    [records, selectedIds],
  );

  const findRecord = useCallback(
    (id: string): DocumentRecord | undefined =>
      records.find((r) => r.id === id),
    [records],
  );

  const applyToRecords = useCallback(
    (
      ids: string[],
      updater: (current: string, record: DocumentRecord) => string,
    ) => {
      setSource((prev) => {
        let next = prev;
        for (const id of ids) {
          const record = interpretDocument(next, previewScenario).find(
            (r) => r.id === id,
          );
          if (!record) continue;
          next = updater(next, record);
        }
        return next;
      });
      markDirty();
    },
    [setSource, markDirty, previewScenario],
  );

  const handleTranslate = useCallback(
    (ids: string[], dx: number, dy: number) => {
      applyToRecords(ids, (current, record) =>
        translateRecord(current, record, dx, dy, zone),
      );
    },
    [applyToRecords, zone],
  );

  const handleResize = useCallback(
    (id: string, box: { x: number; y: number; w: number; h: number }) => {
      const record = findRecord(id);
      if (!record) return;
      setSource((prev) => resizeRecord(prev, record, box, zone));
      markDirty();
    },
    [findRecord, setSource, zone, markDirty],
  );

  const handlePatchRecord = useCallback(
    (record: DocumentRecord, patch: Record<string, string | number>) => {
      setSource((prev) => patchRecordArgs(prev, record, patch, zone));
      markDirty();
    },
    [setSource, zone, markDirty],
  );

  const handleSetColor = useCallback(
    (record: DocumentRecord, color: EdgeColor) => {
      setSource((prev) => setRecordColor(prev, record, color, zone));
      markDirty();
    },
    [setSource, zone, markDirty],
  );

  const handleSetText = useCallback(
    (record: DocumentRecord, text: string) => {
      setSource((prev) => setRecordText(prev, record, text, zone));
      markDirty();
    },
    [setSource, zone, markDirty],
  );

  const handleBindTelemetry = useCallback(
    (record: DocumentRecord, sensor: string, format: TextFormat) => {
      setSource((prev) => bindTextRecordToSensor(prev, record, sensor, format));
      markDirty();
    },
    [setSource, markDirty],
  );

  const handleAdd = useCallback(
    (kind: InsertDrawKind) => {
      setSource((prev) => insertDrawLine(prev, kind));
      markDirty();
    },
    [setSource, markDirty],
  );

  const handleDelete = useCallback(
    (id: string) => {
      const record = findRecord(id);
      if (!record) return;
      setSource((prev) => removeRecordLine(prev, record));
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      markDirty();
    },
    [findRecord, setSource, markDirty],
  );

  const handleValidate = useCallback(async () => {
    const res = await fetch("/api/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source, protocol }),
    });
    if (!res.ok) {
      setValid(false);
      return;
    }
    const body = (await res.json()) as {
      valid: boolean;
      issues: ValidationIssue[];
    };
    setValid(body.valid);
    setValidationIssues(body.issues ?? []);
  }, [source, protocol]);

  const handleSave = useCallback(async () => {
    if (!workspaceKey && !sessionId) {
      setLoadError(
        "No workspace to save to — load a widget via URL or paste Lua first",
      );
      return;
    }
    setSaving(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/widget-source", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          instanceId: workspaceKey,
          sessionId,
          protocol,
        }),
      });
      const body = (await res.json()) as {
        valid: boolean;
        issues?: ValidationIssue[];
        error?: string;
      };
      if (!res.ok) {
        setLoadError(body.error ?? `Save failed (${res.status})`);
        setValid(body.valid ?? false);
        setValidationIssues(body.issues ?? []);
        return;
      }
      setValid(body.valid);
      setValidationIssues(body.issues ?? []);
      savedSourceRef.current = source;
      setDirty(false);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [workspaceKey, sessionId, source, protocol]);

  const handleDownload = useCallback(async () => {
    if (valid === false) {
      setLoadError("Fix validation errors before downloading");
      return;
    }
    if (!workspaceKey && !sessionId && !meta.name) {
      setLoadError("Save the widget before downloading");
      return;
    }
    setDownloading(true);
    setLoadError(null);
    try {
      if (dirty && (workspaceKey || sessionId)) {
        await handleSave();
      }
      const params = new URLSearchParams({ protocol });
      if (sessionId) params.set("sessionId", sessionId);
      else if (workspaceKey) params.set("instanceId", workspaceKey);
      else params.set("name", meta.name);
      const res = await fetch(`/api/download?${params}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setLoadError(body.error ?? `Download failed (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${meta.name}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }, [workspaceKey, sessionId, meta.name, protocol, dirty, handleSave, valid]);

  const handleCopyLua = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(source);
      setCopyDone(true);
      window.setTimeout(() => setCopyDone(false), 1500);
    } catch {
      setLoadError("Could not copy to clipboard");
    }
  }, [source]);

  const selectIssue = useCallback(
    (issue: ValidationIssue) => {
      if (issue.line == null) {
        setMobileTab("layers");
        return;
      }
      const exact = records.find((r) => r.sourceLine === issue.line);
      if (exact) {
        setSelectedIds([exact.id]);
        setMobileTab("properties");
        return;
      }
      let best: DocumentRecord | null = null;
      let bestDist = Infinity;
      for (const r of records) {
        if (r.sourceLine == null) continue;
        const dist = Math.abs(r.sourceLine - issue.line);
        if (dist < bestDist) {
          bestDist = dist;
          best = r;
        }
      }
      if (best && bestDist <= 3) {
        setSelectedIds([best.id]);
        setMobileTab("properties");
      } else {
        setMobileTab("layers");
      }
    },
    [records],
  );

  const backHref = useMemo(() => {
    const params = new URLSearchParams();
    if (chatId) params.set("chatId", chatId);
    const q = params.toString();
    return q ? `/?${q}` : "/";
  }, [chatId]);

  const confirmLeave = useCallback(() => {
    if (!dirty) return true;
    return window.confirm("Discard unsaved changes?");
  }, [dirty]);

  const navigateBack = useCallback(
    (e?: React.MouseEvent) => {
      if (!confirmLeave()) {
        e?.preventDefault();
        return;
      }
      if (!e) router.push(backHref);
    },
    [confirmLeave, router, backHref],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        markDirty();
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        redo();
        markDirty();
      }
      if (e.key === "Escape") {
        setPasteOpen(false);
        setSimOpen(false);
        setSelectedIds([]);
      }
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedIds.length > 0
      ) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        for (const id of selectedIds) handleDelete(id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, selectedIds, handleDelete, markDirty]);

  const openSim = useCallback(() => {
    setSimReloadKey((k) => k + 1);
    setSimOpen(true);
  }, []);

  return (
    <div className={styles.editorRoot}>
      <header className={styles.editorHeader}>
        <div className={styles.brand}>
          <Link
            href={backHref}
            className={styles.logo}
            aria-label="Back to generator"
            onClick={navigateBack}
          >
            ETX
          </Link>
          <div className={styles.brandCopy}>
            <h1 className={styles.editorTitle}>Dashboard Editor</h1>
            <p className={styles.editorSubtitle}>
              <span>{meta.name || "Untitled"}</span>
              <span className={styles.dot} aria-hidden>
                ·
              </span>
              <span>
                {meta.layout} z{meta.zone}
              </span>
              {dirty ? (
                <>
                  <span className={styles.dot} aria-hidden>
                    ·
                  </span>
                  <span className={styles.unsaved}>Unsaved</span>
                </>
              ) : null}
            </p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <Link
            href={backHref}
            className={styles.ghostBtn}
            onClick={navigateBack}
          >
            Back to chat
          </Link>
          <button type="button" className={styles.ghostBtn} onClick={openSim}>
            Run in simulator
          </button>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={() => void handleCopyLua()}
          >
            {copyDone ? "Copied" : "Copy Lua"}
          </button>
          <button
            type="button"
            className={styles.ghostBtn}
            disabled={downloading || valid === false}
            title={
              valid === false
                ? "Fix validation errors before downloading"
                : undefined
            }
            onClick={() => void handleDownload()}
          >
            {downloading ? "Downloading…" : "Download zip"}
          </button>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={() => setPasteOpen(true)}
          >
            Import Lua
          </button>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={() => {
              if (dirty && !window.confirm("Discard unsaved changes?")) return;
              loadFromSource(createStarterSource(), true);
            }}
          >
            New
          </button>
        </div>
      </header>

      {loadError && (
        <div className={styles.bannerStack}>
          <div className={styles.errorBanner} role="alert">
            {loadError}
            <button
              type="button"
              className={styles.bannerDismiss}
              onClick={() => setLoadError(null)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {(previewMeta.skippedTextCount > 0 || previewMeta.unreliable) && (
        <div className={styles.bannerStack}>
          <div className={styles.warnBanner} role="status">
            <strong>Canvas preview may differ from the radio</strong>
            <ul>
              {previewMeta.skippedTextCount > 0 && (
                <li>
                  {previewMeta.skippedTextCount} text draw(s) could not be
                  evaluated statically — use Run in simulator to verify.
                </li>
              )}
              {previewMeta.unreliable && (
                <li>
                  Gauge layout could not be fully resolved — verify in the WASM
                  simulator.
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      <EditorToolbar
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => {
          undo();
          markDirty();
        }}
        onRedo={() => {
          redo();
          markDirty();
        }}
        onAdd={handleAdd}
        onSave={handleSave}
        onValidate={handleValidate}
        saving={saving}
        valid={valid}
        protocol={protocol}
        onProtocolChange={setProtocol}
        onVerifySim={openSim}
        previewScenarioId={previewScenarioId}
        onPreviewScenarioChange={setPreviewScenarioId}
      />

      <div
        className={styles.mobileTabs}
        role="tablist"
        aria-label="Editor panels"
      >
        {(
          [
            ["layers", "Layers"],
            ["canvas", "Canvas"],
            ["properties", "Properties"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mobileTab === id}
            className={
              mobileTab === id ? styles.mobileTabActive : styles.mobileTab
            }
            onClick={() => setMobileTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={styles.editorBody} data-mobile-tab={mobileTab}>
        <div className={`${styles.mobilePane} ${styles.mobilePaneLayers}`}>
          <RecordLayersPanel
            records={records}
            selectedIds={selectedIds}
            onSelect={(id, additive) =>
              setSelectedIds((prev) =>
                additive
                  ? prev.includes(id)
                    ? prev.filter((x) => x !== id)
                    : [...prev, id]
                  : [id],
              )
            }
            onDelete={handleDelete}
          />
        </div>

        <div className={`${styles.mobilePane} ${styles.mobilePaneCanvas}`}>
          {remoteLoadPending ? (
            <div className={styles.canvasStage}>
              <div className={styles.loadingPreview}>Loading widget…</div>
            </div>
          ) : (
            <EditorCanvas
              source={source}
              records={records}
              zone={zone}
              selectedIds={selectedIds}
              onSelect={setSelectedIds}
              onTranslate={handleTranslate}
              onResize={handleResize}
              showSnapGuides
              scenarioId={previewScenarioId}
            />
          )}
        </div>

        <div
          className={`${styles.rightColumn} ${styles.mobilePane} ${styles.mobilePaneProperties}`}
        >
          <RecordPropertiesPanel
            meta={meta}
            selectedRecords={selectedRecords}
            zone={zone}
            protocol={protocol}
            onPatchName={(name) => {
              setSource((prev) => patchWidgetName(prev, name));
              markDirty();
            }}
            onPatchRecord={handlePatchRecord}
            onSetColor={handleSetColor}
            onSetText={handleSetText}
            onBindTelemetry={handleBindTelemetry}
            onPatchSimulate={(layout, zoneIdx) => {
              setSource((prev) =>
                prev.replace(
                  /@simulate\s+\S+\s+zone=\d+/,
                  `@simulate ${layout} zone=${zoneIdx}`,
                ),
              );
              markDirty();
            }}
          />
          {validationIssues.length > 0 && (
            <div className={styles.validationPanel}>
              <h3 className={styles.sectionTitle}>Validation</h3>
              <ul className={styles.validationList}>
                {validationIssues.map((issue, i) => (
                  <li
                    key={`${issue.message}-${i}`}
                    data-severity={issue.severity}
                  >
                    {issue.line != null ? (
                      <button
                        type="button"
                        className={styles.issueLink}
                        onClick={() => selectIssue(issue)}
                      >
                        L{issue.line}: {issue.message}
                      </button>
                    ) : (
                      issue.message
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <SimVerifyModal
        source={source}
        open={simOpen}
        onClose={() => setSimOpen(false)}
        reloadKey={simReloadKey}
        onReload={() => setSimReloadKey((k) => k + 1)}
        scenarioId={previewScenarioId}
      />

      {pasteOpen && (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onClick={() => setPasteOpen(false)}
        >
          <div
            className={styles.modal}
            role="dialog"
            aria-labelledby="import-title"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHead}>
              <h2 id="import-title" className={styles.modalTitle}>
                Import Lua
              </h2>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setPasteOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p className={styles.modalHint}>
              Paste an EdgeTX widget <code>main.lua</code>. The editor patches
              draw lines in place.
            </p>
            <textarea
              className={styles.modalTextarea}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="---@type WidgetScript&#10;---@simulate Layout1x1 zone=0&#10;..."
              rows={12}
              autoFocus
            />
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={() => setPasteOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => {
                  loadFromSource(pasteText);
                  setPasteOpen(false);
                }}
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
