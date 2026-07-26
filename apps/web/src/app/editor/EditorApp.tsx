"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  bindTextRecordToSensorDetailed,
  createStarterSource,
  interpretDocument,
  insertDrawLineWithId,
  insertPrefabSection,
  insertPrefabSections,
  STACYDASH_TX15_LAYOUT_ORDER,
  STACYDASH_NITRO_LAYOUT_ORDER,
  parseDocumentMeta,
  patchRecordArgs,
  patchWidgetName,
  removeRecordLines,
  remapRecordIdsAfterLineRemoval,
  remapSrcSensor,
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
  mergeLiveIntoMock,
  parseLuaToDrawCommands,
  type EdgeColor,
  type LayoutScenario,
} from "@widget-gen/layout-verify";
import type { TelemetryProtocol, ValidationIssue } from "@widget-gen/shared";
import {
  DEFAULT_RADIO_ID,
  getSimulateLayoutProfile,
  isLayoutProfileId,
  resolvePreviewDimensions,
  type LayoutProfileId,
} from "@widget-gen/shared";
import { useRouter } from "next/navigation";
import { AppChrome } from "~/components/AppChrome";
import { useSourceUndoStack } from "./hooks/useSourceUndoStack";
import { EditorCanvas } from "./components/EditorCanvas";
import { RecordLayersPanel } from "./components/RecordLayersPanel";
import { RecordPropertiesPanel } from "./components/RecordPropertiesPanel";
import { EditorToolbar } from "./components/EditorToolbar";
import { SimVerifyModal } from "./components/SimVerifyModal";
import {
  ProjectLibraryModal,
  type ProjectLibraryMode,
} from "./components/ProjectLibraryModal";
import type { InsertDrawKind } from "./elementMeta";
import { AppPreferencesButton } from "~/components/AppPreferences";
import {
  deleteProject,
  getLastOpenProjectId,
  getProject,
  loadProjectSource,
  markProjectOpened,
  newProjectId,
  renameProject,
  saveProjectSource,
  upsertProject,
} from "~/lib/projectLibrary";
import {
  isWebSerialSupported,
  openLiveTelemetryPort,
  type LiveSensorMap,
  type LiveTelemetryHandle,
} from "~/lib/liveTelemetryBridge";
import {
  addCompanionSuite,
  loadEditorCompanions,
  saveEditorCompanions,
  type CompanionSuiteId,
  type EditorCompanionState,
} from "~/lib/companionSuites";
import {
  alignSelectedRecords,
  distributeSelectedRecords,
  type AlignMode,
  type DistributeMode,
} from "./alignSelection";
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
  const [layoutProfileId, setLayoutProfileId] = useState<LayoutProfileId>(
    () => {
      const raw =
        searchParams.get("layoutProfile") ??
        searchParams.get("radioId") ??
        DEFAULT_RADIO_ID;
      return isLayoutProfileId(raw) ? raw : DEFAULT_RADIO_ID;
    },
  );
  const [radioId, setRadioId] = useState(
    () => searchParams.get("radioId") ?? layoutProfileId,
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
  const [projectId, setProjectId] = useState<string | null>(null);
  const [liveTelemetryActive, setLiveTelemetryActive] = useState(false);
  const [liveTelemetryValues, setLiveTelemetryValues] =
    useState<LiveSensorMap | null>(null);
  const [liveTelemetryNote, setLiveTelemetryNote] = useState<string | null>(
    null,
  );
  const [projectModal, setProjectModal] = useState<ProjectLibraryMode | null>(
    null,
  );
  const [lastProjectOffer, setLastProjectOffer] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [modelPngBytes, setModelPngBytes] = useState<Uint8Array | null>(null);
  const [modelPngName, setModelPngName] = useState<string | null>(null);
  const [companions, setCompanions] = useState<EditorCompanionState>({
    suites: [],
    files: [],
  });
  const liveHandleRef = useRef<LiveTelemetryHandle | null>(null);
  const liveTelemetrySupported = useMemo(
    () => (typeof window !== "undefined" ? isWebSerialSupported() : false),
    [],
  );
  const loadRequestIdRef = useRef(0);
  const savedSourceRef = useRef<string | null>(null);

  const {
    source,
    setSource,
    replaceSource,
    beginTransient,
    endTransient,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useSourceUndoStack(createStarterSource());

  const meta = useMemo(() => parseDocumentMeta(source), [source]);
  const previewScenario: LayoutScenario = useMemo(() => {
    const base = getPreviewScenario(previewScenarioId);
    if (!liveTelemetryActive || !liveTelemetryValues) return base;
    return {
      ...base,
      mock: mergeLiveIntoMock(base.mock, liveTelemetryValues),
    };
  }, [previewScenarioId, liveTelemetryActive, liveTelemetryValues]);
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
      getSimulateLayoutProfile(layoutProfileId),
    );
    return {
      zoneX: dims.zoneX,
      zoneY: dims.zoneY,
      zoneW: dims.zoneW,
      zoneH: dims.zoneH,
    };
  }, [source, layoutProfileId]);

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

  const applyToRecords = useCallback(
    (
      ids: string[],
      updater: (current: string, record: DocumentRecord) => string,
      opts?: { history?: boolean },
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
      }, opts);
      markDirty();
    },
    [setSource, markDirty, previewScenario],
  );

  const handleTranslate = useCallback(
    (ids: string[], dx: number, dy: number) => {
      applyToRecords(
        ids,
        (current, record) => translateRecord(current, record, dx, dy, zone),
        { history: false },
      );
    },
    [applyToRecords, zone],
  );

  const handleResize = useCallback(
    (id: string, box: { x: number; y: number; w: number; h: number }) => {
      setSource(
        (prev) => {
          const record = interpretDocument(prev, previewScenario).find(
            (r) => r.id === id,
          );
          if (!record) return prev;
          return resizeRecord(prev, record, box, zone);
        },
        { history: false },
      );
      markDirty();
    },
    [setSource, zone, markDirty, previewScenario],
  );

  const handleGestureStart = useCallback(() => {
    beginTransient();
  }, [beginTransient]);

  const handleGestureEnd = useCallback(() => {
    endTransient();
  }, [endTransient]);

  const handlePatchRecord = useCallback(
    (record: DocumentRecord, patch: Record<string, string | number>) => {
      setSource((prev) => {
        const live = interpretDocument(prev, previewScenario).find(
          (r) => r.id === record.id,
        );
        if (!live) return prev;
        return patchRecordArgs(prev, live, patch, zone);
      });
      markDirty();
    },
    [setSource, zone, markDirty, previewScenario],
  );

  const handleSetColor = useCallback(
    (record: DocumentRecord, color: EdgeColor) => {
      setSource((prev) => {
        const live = interpretDocument(prev, previewScenario).find(
          (r) => r.id === record.id,
        );
        if (!live) return prev;
        return setRecordColor(prev, live, color, zone);
      });
      markDirty();
    },
    [setSource, zone, markDirty, previewScenario],
  );

  const handleSetText = useCallback(
    (record: DocumentRecord, text: string) => {
      setSource((prev) => {
        const live = interpretDocument(prev, previewScenario).find(
          (r) => r.id === record.id,
        );
        if (!live) return prev;
        return setRecordText(prev, live, text, zone);
      });
      markDirty();
    },
    [setSource, zone, markDirty, previewScenario],
  );

  const handleBindTelemetry = useCallback(
    (record: DocumentRecord, sensor: string, format: TextFormat) => {
      let nextSelectedId: string | null = null;
      setSource((prev) => {
        const live = interpretDocument(prev, previewScenario).find(
          (r) => r.id === record.id,
        );
        if (!live) return prev;
        const result = bindTextRecordToSensorDetailed(
          prev,
          live,
          sensor,
          format,
        );
        nextSelectedId = result.recordId;
        return result.source;
      });
      if (nextSelectedId) setSelectedIds([nextSelectedId]);
      markDirty();
    },
    [setSource, markDirty, previewScenario],
  );

  const handleRemapSrcSensor = useCallback(
    (key: string, sensor: string) => {
      setSource((prev) => remapSrcSensor(prev, key, sensor));
      markDirty();
    },
    [setSource, markDirty],
  );

  const handleAdd = useCallback(
    (kind: InsertDrawKind) => {
      let insertedId: string | null = null;
      setSource((prev) => {
        const result = insertDrawLineWithId(prev, kind, previewScenario);
        insertedId = result.insertedId;
        return result.source;
      });
      if (insertedId) setSelectedIds([insertedId]);
      markDirty();
    },
    [setSource, markDirty, previewScenario],
  );

  const handleAddPrefab = useCallback(
    (prefabId: string) => {
      setSource((prev) => {
        const result = insertPrefabSection(prev, prefabId);
        return result?.source ?? prev;
      });
      markDirty();
    },
    [setSource, markDirty],
  );

  const handleAddFullStacyDash = useCallback(() => {
    // Starter has 2 draw records; confirm when the board already has work.
    const busy = source.includes("-- prefab:") || records.length > 2;
    if (
      busy &&
      !window.confirm(
        "Add all 6 StacyDash sections to this board? Existing elements stay; prefabs are appended.",
      )
    ) {
      return;
    }
    setSource((prev) => {
      const { source: next } = insertPrefabSections(prev, [
        ...STACYDASH_TX15_LAYOUT_ORDER,
      ]);
      return next;
    });
    markDirty();
  }, [setSource, markDirty, source, records]);

  const handleAddNitroStacyDash = useCallback(() => {
    const busy = source.includes("-- prefab:") || records.length > 2;
    if (
      busy &&
      !window.confirm(
        "Add StacyDash nitro sections (RX pack tiles + voltage bar)? Existing elements stay.",
      )
    ) {
      return;
    }
    setSource((prev) => {
      const { source: next } = insertPrefabSections(prev, [
        ...STACYDASH_NITRO_LAYOUT_ORDER,
      ]);
      return next;
    });
    markDirty();
  }, [setSource, markDirty, source, records]);

  const companionStorageKey = workspaceKey ?? projectId ?? "local-editor";

  useEffect(() => {
    setCompanions(loadEditorCompanions(companionStorageKey));
  }, [companionStorageKey]);

  const handleAddCompanionSuite = useCallback(
    (suiteId: string) => {
      const next = addCompanionSuite(companions, suiteId as CompanionSuiteId);
      setCompanions(next);
      saveEditorCompanions(companionStorageKey, next);
      setLiveTelemetryNote(
        `Companion suite added — download/install will include ${next.files.length} script(s).`,
      );
      const key = workspaceKey ?? sessionId;
      if (key) {
        void fetch("/api/widget-companions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceKey: workspaceKey ?? undefined,
            sessionId: sessionId ?? undefined,
            files: next.files,
          }),
        }).catch(() => {
          /* localStorage still holds the suite for desktop extraFiles */
        });
      }
    },
    [companions, companionStorageKey, workspaceKey, sessionId],
  );

  const handleModelPngChange = useCallback(async (file: File | null) => {
    if (!file) {
      setModelPngBytes(null);
      setModelPngName(null);
      return;
    }
    if (file.type !== "image/png") {
      window.alert("Model image must be a PNG.");
      return;
    }
    const buf = new Uint8Array(await file.arrayBuffer());
    setModelPngBytes(buf);
    setModelPngName(file.name);
  }, []);

  const handleAlign = useCallback(
    (mode: string) => {
      if (selectedIds.length < 2) return;
      const next = alignSelectedRecords(
        source,
        records,
        selectedIds,
        zone,
        mode as AlignMode,
      );
      if (next !== source) {
        setSource(next);
        markDirty();
      }
    },
    [selectedIds, source, records, zone, setSource, markDirty],
  );

  const handleDistribute = useCallback(
    (mode: string) => {
      if (selectedIds.length < 3) return;
      const next = distributeSelectedRecords(
        source,
        records,
        selectedIds,
        zone,
        mode as DistributeMode,
      );
      if (next !== source) {
        setSource(next);
        markDirty();
      }
    },
    [selectedIds, source, records, zone, setSource, markDirty],
  );

  const handleSaveNamed = useCallback(
    (name: string) => {
      const id = projectId ?? newProjectId();
      upsertProject({
        id,
        name,
        protocol,
        workspaceKey: workspaceKey ?? undefined,
        sessionId: sessionId ?? undefined,
        radioId,
        layoutProfileId,
        sourcePreview: source.slice(0, 120),
      });
      saveProjectSource(id, source);
      setProjectId(id);
      setProjectModal(null);
    },
    [
      projectId,
      protocol,
      workspaceKey,
      sessionId,
      source,
      radioId,
      layoutProfileId,
    ],
  );

  const openProjectById = useCallback(
    (id: string) => {
      const project = getProject(id);
      const lua = loadProjectSource(id);
      if (!lua) {
        setLiveTelemetryNote(
          "No saved Lua for that project in this browser — use Save as… after editing.",
        );
        return;
      }
      setSource(lua);
      setProjectId(id);
      if (project?.protocol) {
        setProtocol(project.protocol as TelemetryProtocol);
      }
      if (
        project?.layoutProfileId &&
        isLayoutProfileId(project.layoutProfileId)
      ) {
        setLayoutProfileId(project.layoutProfileId);
      }
      if (project?.radioId) setRadioId(project.radioId);
      markProjectOpened(id);
      setDirty(false);
      setProjectModal(null);
      setLastProjectOffer(null);
    },
    [setSource],
  );

  const handleOpenRecent = useCallback(() => {
    setProjectModal("recent");
  }, []);

  const handleOpenLast = useCallback(() => {
    const id = getLastOpenProjectId();
    if (!id) {
      setLiveTelemetryNote("No last project — use Save as… first.");
      return;
    }
    openProjectById(id);
  }, [openProjectById]);

  const handleToggleLiveTelemetry = useCallback(async () => {
    if (liveTelemetryActive) {
      await liveHandleRef.current?.close();
      liveHandleRef.current = null;
      setLiveTelemetryActive(false);
      setLiveTelemetryValues(null);
      setLiveTelemetryNote(null);
      return;
    }
    try {
      const handle = await openLiveTelemetryPort(
        (values) => {
          setLiveTelemetryValues(values);
          const keys = Object.keys(values);
          setLiveTelemetryNote(
            keys.length
              ? `Live radio · ${keys.slice(0, 6).join(", ")}${keys.length > 6 ? "…" : ""} (canvas + sim)`
              : "Live radio · waiting for CRSF frames",
          );
        },
        { enrichRotorflight: protocol === "rotorflight" },
      );
      liveHandleRef.current = handle;
      setLiveTelemetryActive(true);
      setLiveTelemetryNote(
        protocol === "rotorflight"
          ? "Live radio · CRSF on wire; HSpd/Gov/Vbec filled by preview enrich until rf2bg sensors appear"
          : "Live radio · waiting for CRSF frames",
      );
    } catch (err) {
      setLiveTelemetryNote(
        err instanceof Error ? err.message : "Failed to open serial port",
      );
    }
  }, [liveTelemetryActive, protocol]);

  const discoveredSensors = useMemo(() => {
    if (!liveTelemetryValues) return [] as string[];
    return Object.keys(liveTelemetryValues).sort();
  }, [liveTelemetryValues]);

  useEffect(() => {
    return () => {
      void liveHandleRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (hasRemoteWidget) return;
    const id = getLastOpenProjectId();
    if (!id) return;
    const project = getProject(id);
    if (!project || !loadProjectSource(id)) return;
    setLastProjectOffer({ id, name: project.name });
  }, [hasRemoteWidget]);

  const handleDeleteIds = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const current = interpretDocument(source, previewScenario);
      const targets = ids
        .map((id) => current.find((r) => r.id === id))
        .filter((r): r is DocumentRecord => r != null);
      if (targets.length === 0) return;
      const removedLines = targets
        .map((r) => r.sourceLine)
        .filter((n): n is number => typeof n === "number");
      setSource((prev) => removeRecordLines(prev, targets));
      setSelectedIds((prev) =>
        remapRecordIdsAfterLineRemoval(prev, removedLines),
      );
      markDirty();
    },
    [setSource, markDirty, previewScenario, source],
  );

  const handleDelete = useCallback(
    (id: string) => {
      handleDeleteIds([id]);
    },
    [handleDeleteIds],
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
    const nudgeActive = { current: false };
    const endNudge = () => {
      if (!nudgeActive.current) return;
      nudgeActive.current = false;
      endTransient();
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!saving && valid !== false) void handleSave();
        return;
      }
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
        handleDeleteIds(selectedIds);
      }
      if (
        selectedIds.length > 0 &&
        (e.key === "ArrowLeft" ||
          e.key === "ArrowRight" ||
          e.key === "ArrowUp" ||
          e.key === "ArrowDown")
      ) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        if (!nudgeActive.current) {
          nudgeActive.current = true;
          beginTransient();
        }
        const step = e.shiftKey ? 1 : 12;
        const dx =
          e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy =
          e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        applyToRecords(
          selectedIds,
          (current, record) => translateRecord(current, record, dx, dy, zone),
          { history: false },
        );
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight" ||
        e.key === "ArrowUp" ||
        e.key === "ArrowDown"
      ) {
        endNudge();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", endNudge);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", endNudge);
      endNudge();
    };
  }, [
    undo,
    redo,
    selectedIds,
    handleDeleteIds,
    markDirty,
    applyToRecords,
    zone,
    beginTransient,
    endTransient,
    handleSave,
    saving,
    valid,
  ]);

  const openSim = useCallback(() => {
    setSimReloadKey((k) => k + 1);
    setSimOpen(true);
  }, []);

  const layoutSelfHref = useMemo(() => {
    const params = new URLSearchParams({ protocol });
    if (chatId) params.set("chatId", chatId);
    if (sessionId) params.set("sessionId", sessionId);
    if (workspaceKey) params.set("instanceId", workspaceKey);
    else if (meta.name) params.set("name", meta.name);
    return `/editor?${params.toString()}`;
  }, [protocol, chatId, sessionId, workspaceKey, meta.name]);

  const subtitle = (
    <>
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
    </>
  );

  return (
    <div className={styles.editorRoot}>
      <AppChrome
        surface="layout"
        subtitle={subtitle}
        layoutHref={layoutSelfHref}
        actions={
          <>
            <AppPreferencesButton className={styles.ghostBtn} />
            <Link
              href={backHref}
              className={styles.ghostBtn}
              onClick={navigateBack}
            >
              <span className={styles.actionLabelFull}>Back to Generate</span>
              <span className={styles.actionLabelShort}>Generate</span>
            </Link>
            <button type="button" className={styles.ghostBtn} onClick={openSim}>
              <span className={styles.actionLabelFull}>Run in simulator</span>
              <span className={styles.actionLabelShort}>Sim</span>
            </button>
            <button
              type="button"
              className={`${styles.ghostBtn} ${styles.hideOnNarrow}`}
              onClick={() => void handleCopyLua()}
            >
              {copyDone ? (
                "Copied"
              ) : (
                <>
                  <span className={styles.actionLabelFull}>Copy Lua</span>
                  <span className={styles.actionLabelShort}>Copy</span>
                </>
              )}
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
              {downloading ? (
                "Downloading…"
              ) : (
                <>
                  <span className={styles.actionLabelFull}>Download zip</span>
                  <span className={styles.actionLabelShort}>Zip</span>
                </>
              )}
            </button>
            <button
              type="button"
              className={`${styles.ghostBtn} ${styles.hideOnNarrow}`}
              onClick={() => setPasteOpen(true)}
            >
              <span className={styles.actionLabelFull}>Import Lua</span>
              <span className={styles.actionLabelShort}>Import</span>
            </button>
            <button
              type="button"
              className={`${styles.ghostBtn} ${styles.hideOnNarrow}`}
              onClick={() => {
                if (dirty && !window.confirm("Discard unsaved changes?"))
                  return;
                loadFromSource(createStarterSource(), true);
              }}
            >
              New
            </button>
          </>
        }
      />

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
        onAddPrefab={handleAddPrefab}
        onAddFullStacyDash={
          protocol === "rotorflight" ? handleAddFullStacyDash : undefined
        }
        onAddNitroStacyDash={
          protocol === "rotorflight" ? handleAddNitroStacyDash : undefined
        }
        onAddCompanionSuite={handleAddCompanionSuite}
        companionSuiteIds={companions.suites}
        onSave={handleSave}
        onSaveNamed={() => setProjectModal("save")}
        onOpenRecent={handleOpenRecent}
        onOpenLast={handleOpenLast}
        onValidate={handleValidate}
        saving={saving}
        valid={valid}
        protocol={protocol}
        onProtocolChange={setProtocol}
        onVerifySim={openSim}
        previewScenarioId={previewScenarioId}
        onPreviewScenarioChange={setPreviewScenarioId}
        liveTelemetryActive={liveTelemetryActive}
        onToggleLiveTelemetry={handleToggleLiveTelemetry}
        liveTelemetrySupported={liveTelemetrySupported}
        modelPngName={modelPngName}
        onModelPngChange={(file) => void handleModelPngChange(file)}
        onAlign={handleAlign}
        onDistribute={handleDistribute}
        canAlign={selectedIds.length >= 2}
        canDistribute={selectedIds.length >= 3}
      />

      {protocol === "rotorflight" ? (
        <div className={styles.protocolCallout} role="status">
          Rotorflight: enable <strong>rf2bg</strong> (Special Function, Repeat
          On), then Telemetry → Discover new for HSpd / EscT / Vbec / Vcel /
          Gov. Insert → Full StacyDash (electric) or StacyDash nitro board.
        </div>
      ) : null}
      {lastProjectOffer ? (
        <div className={styles.protocolCallout} role="status">
          Resume <strong>{lastProjectOffer.name}</strong>?{" "}
          <button
            type="button"
            className={styles.calloutLink}
            onClick={() => openProjectById(lastProjectOffer.id)}
          >
            Open last
          </button>
          <button
            type="button"
            className={styles.calloutLink}
            onClick={() => setLastProjectOffer(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}
      {liveTelemetryNote ? (
        <div className={styles.protocolCallout} role="status">
          {liveTelemetryNote}
          {liveTelemetryActive && protocol === "rotorflight" ? (
            <>
              {" "}
              <span className={styles.calloutMuted}>
                Enrich fills missing HSpd/Gov/Vbec — not true FC sensors until
                rf2bg + Discover new.
              </span>
            </>
          ) : null}
        </div>
      ) : null}

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
              onGestureStart={handleGestureStart}
              onGestureEnd={handleGestureEnd}
              showSnapGuides
              scenarioId={previewScenarioId}
              scenarioOverride={
                liveTelemetryActive ? previewScenario : undefined
              }
              layoutProfileId={layoutProfileId}
            />
          )}
        </div>

        <div
          className={`${styles.rightColumn} ${styles.mobilePane} ${styles.mobilePaneProperties}`}
        >
          <RecordPropertiesPanel
            meta={meta}
            source={source}
            selectedRecords={selectedRecords}
            zone={zone}
            protocol={protocol}
            discoveredSensors={discoveredSensors}
            onPatchName={(name) => {
              setSource((prev) => patchWidgetName(prev, name));
              markDirty();
            }}
            onPatchRecord={handlePatchRecord}
            onTranslateSelected={(dx, dy) => {
              applyToRecords(selectedIds, (current, record) =>
                translateRecord(current, record, dx, dy, zone),
              );
            }}
            onSetColor={handleSetColor}
            onSetText={handleSetText}
            onBindTelemetry={handleBindTelemetry}
            onRemapSrcSensor={handleRemapSrcSensor}
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
        scenarioOverride={liveTelemetryActive ? previewScenario : undefined}
        layoutProfileId={layoutProfileId}
        modelPng={modelPngBytes}
      />

      <ProjectLibraryModal
        open={projectModal != null}
        mode={projectModal ?? "save"}
        defaultName={meta.name || "Dashboard"}
        projectId={projectId}
        onClose={() => setProjectModal(null)}
        onSave={handleSaveNamed}
        onOpen={openProjectById}
        onRename={(id, name) => {
          renameProject(id, name);
        }}
        onDelete={(id) => {
          deleteProject(id);
          if (projectId === id) setProjectId(null);
        }}
        onImported={(id) => openProjectById(id)}
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
