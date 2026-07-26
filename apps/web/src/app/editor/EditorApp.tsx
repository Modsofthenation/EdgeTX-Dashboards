"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  applyDashboardBackground,
  bindTextRecordToSensorDetailed,
  createStarterSource,
  DEFAULT_BG_IMAGE_PATH,
  getLayoutTemplateBoardSource,
  interpretDocument,
  insertDrawLineWithId,
  DENSE_CRSF_LAYOUT_ORDER,
  FREESTYLE_LAYOUT_ORDER,
  insertPrefabSection,
  insertPrefabSections,
  MINIMAL_QUAD_LAYOUT_ORDER,
  ROTORFLIGHT_ELECTRIC_LAYOUT_ORDER,
  ROTORFLIGHT_NITRO_LAYOUT_ORDER,
  WHOOP_LAYOUT_ORDER,
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
  duplicateRecordLine,
  moveRecordLine,
  reorderRecordLine,
  getSourceLine,
  remapPreviewOnlyColorLiterals,
  type DocumentRecord,
  type TextFormat,
  type ZoneOffset,
} from "@widget-gen/editor-core";
import {
  getLastPreviewParseMeta,
  getPreviewScenario,
  isInterpretationReliable,
  mergeLiveIntoMock,
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
import { AppChrome } from "~/components/AppChrome";
import { useSourceUndoStack } from "./hooks/useSourceUndoStack";
import { EditorCanvas } from "./components/EditorCanvas";
import { RecordLayersPanel } from "./components/RecordLayersPanel";
import { RecordPropertiesPanel } from "./components/RecordPropertiesPanel";
import { EditorToolbar } from "./components/EditorToolbar";
import { EditorMenu } from "./components/EditorMenu";
import { SimVerifyModal } from "./components/SimVerifyModal";
import {
  ProjectLibraryModal,
  type ProjectLibraryMode,
} from "./components/ProjectLibraryModal";
import type { InsertDrawKind } from "./elementMeta";
import { openAppPreferences, AppPreferencesHost } from "~/components/AppPreferences";
import {
  deleteProject,
  getLastOpenProjectId,
  getProject,
  loadProjectCompanions,
  loadProjectModelImage,
  loadProjectSource,
  markProjectOpened,
  newProjectId,
  renameProject,
  saveNamedVersion,
  saveProjectCompanions,
  saveProjectModelImage,
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
  companionFilesToSd,
  companionStateFromDiskFiles,
  getCompanionSuite,
  loadEditorCompanions,
  modelPngToSdFile,
  saveEditorCompanions,
  type CompanionSuiteId,
  type EditorCompanionState,
} from "~/lib/companionSuites";
import {
  getTemplateById,
  type TemplateLayoutPrefab,
} from "~/lib/templateGallery";
import { fetchRadioCatalog } from "~/lib/radioCatalog";
import {
  buildInstallGuide,
  formatInstallGuideMarkdown,
} from "~/lib/installGuide";
import { ExportInstallModal } from "./components/ExportInstallModal";
import { CanvasContextMenu } from "./components/CanvasContextMenu";
import type { CanvasContextMenuItem } from "./components/CanvasContextMenu";
import {
  alignSelectedRecords,
  distributeSelectedRecords,
  type AlignMode,
  type DistributeMode,
} from "./alignSelection";
import styles from "./editor.module.css";

type MobileTab = "layers" | "canvas" | "properties";

const IS_MAC =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);

function modShortcut(key: string): string {
  return IS_MAC ? `⌘${key}` : `Ctrl+${key}`;
}

function findRecordByLineText(
  source: string,
  lineText: string,
  scenario: LayoutScenario | undefined,
): DocumentRecord | undefined {
  return interpretDocument(source, scenario).find((r) => {
    const line = r.sourceRef?.sourceLine ?? r.sourceLine;
    return line != null && getSourceLine(source, line) === lineText;
  });
}

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
    /* ignore quota / private mode */
  }
}

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
  const instanceId = searchParams.get("instanceId");
  const widgetName = searchParams.get("name");
  const sid = searchParams.get("sessionId");
  const chatId = searchParams.get("chatId");
  const templateId = searchParams.get("template");
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
  const [copyDone, setCopyDone] = useState(false);
  const [workspaceKey, setWorkspaceKey] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [canvasMenu, setCanvasMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
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
  const [liveWireKeys, setLiveWireKeys] = useState<string[]>([]);
  const [liveEnrichKeys, setLiveEnrichKeys] = useState<string[]>([]);
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
  const [showSnapGuides, setShowSnapGuides] = useState(true);
  const [enrichRotorflight, setEnrichRotorflight] = useState(
    readEnrichRotorflightPreference,
  );
  const [companions, setCompanions] = useState<EditorCompanionState>({
    suites: [],
    files: [],
  });
  const [radioTouch, setRadioTouch] = useState(true);
  const [radioDisplayName, setRadioDisplayName] = useState<string | null>(null);
  const liveHandleRef = useRef<LiveTelemetryHandle | null>(null);
  const templateAppliedRef = useRef<string | null>(null);
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
    // interpretDocument already ran parseLuaToDrawCommands; reuse its meta.
    const parseMeta = getLastPreviewParseMeta();
    return {
      skippedTextCount: parseMeta.skippedTextCount,
      unreliable: !isInterpretationReliable(
        records,
        parseMeta.skippedTextCount,
      ),
      warnings: parseMeta.warnings,
    };
  }, [records]);

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

  const prefabLcd = useMemo(() => {
    const profile = getSimulateLayoutProfile(layoutProfileId);
    return { lcdW: profile.lcdW, lcdH: profile.lcdH };
  }, [layoutProfileId]);

  const markDirty = useCallback(() => {
    setDirty(true);
    setValid(null);
  }, []);

  const loadFromSource = useCallback(
    (nextSource: string, markClean = false) => {
      const remapped = remapPreviewOnlyColorLiterals(nextSource).source;
      replaceSource(remapped);
      setSelectedIds([]);
      setValid(null);
      setValidationIssues([]);
      if (markClean) {
        savedSourceRef.current = remapped;
        setDirty(false);
      } else {
        setDirty(true);
      }
    },
    [replaceSource],
  );

  useEffect(() => {
    void fetchRadioCatalog().then((catalog) => {
      const entry =
        catalog.radios.find((r) => r.id === radioId) ??
        catalog.radios.find((r) => r.layoutProfile === layoutProfileId);
      if (entry) {
        setRadioTouch(entry.touch);
        setRadioDisplayName(entry.name);
      }
    });
  }, [radioId, layoutProfileId]);

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

        // Hydrate companions + model PNG from the same disk workspace.
        if (wk) {
          try {
            const companionsRes = await fetch(
              `/api/widget-companions?workspaceKey=${encodeURIComponent(wk)}`,
              { signal: controller.signal },
            );
            if (
              companionsRes.ok &&
              requestId === loadRequestIdRef.current
            ) {
              const data = (await companionsRes.json()) as {
                files?: {
                  relPath: string;
                  content: string;
                  encoding?: "utf8" | "base64";
                  kind?: string;
                }[];
              };
              const files = Array.isArray(data.files) ? data.files : [];
              const nextCompanions = companionStateFromDiskFiles(files);
              if (nextCompanions.files.length > 0) {
                setCompanions(nextCompanions);
                saveEditorCompanions(wk, nextCompanions);
              }
              const image = files.find(
                (f) =>
                  f.kind === "image" ||
                  (f.relPath.startsWith("images/") &&
                    /\.png$/i.test(f.relPath)),
              );
              if (image?.content) {
                try {
                  const bin = atob(image.content);
                  const bytes = new Uint8Array(bin.length);
                  for (let i = 0; i < bin.length; i++)
                    bytes[i] = bin.charCodeAt(i);
                  setModelPngBytes(bytes);
                  setModelPngName(
                    image.relPath.split("/").pop() ?? "simmodel.png",
                  );
                } catch {
                  /* ignore bad base64 */
                }
              }
            }
          } catch {
            /* companions optional — Lua still loads */
          }
        }
      })
      .catch((err: Error) => {
        if (controller.signal.aborted || requestId !== loadRequestIdRef.current)
          return;
        setLoadError(err.message);
      })
      .finally(() => {
        if (requestId !== loadRequestIdRef.current) return;
        setRemoteLoadPending(false);
      });

    return () => controller.abort();
  }, [instanceId, widgetName, sid, loadFromSource]);

  /** Template → Layout: apply complete board / prefab once when opening without a workspace. */
  useEffect(() => {
    if (hasRemoteWidget || !templateId) return;
    if (templateAppliedRef.current === templateId) return;
    const template = getTemplateById(templateId);
    if (!template) return;
    templateAppliedRef.current = templateId;
    const prefab: TemplateLayoutPrefab = template.layoutPrefab ?? "starter";
    setProtocol(template.protocol);
    if (prefab === "rf-heli-electric") {
      const { source: next } = insertPrefabSections(
        createStarterSource(),
        [...ROTORFLIGHT_ELECTRIC_LAYOUT_ORDER],
        prefabLcd,
      );
      loadFromSource(next, true);
      setCompanions((prev) => addCompanionSuite(prev, "rf-heli-electric"));
    } else if (prefab === "rf-heli-nitro") {
      const { source: next } = insertPrefabSections(
        createStarterSource(),
        [...ROTORFLIGHT_NITRO_LAYOUT_ORDER],
        prefabLcd,
      );
      loadFromSource(next, true);
    } else if (prefab === "battery-tool") {
      loadFromSource(getLayoutTemplateBoardSource("battery-tool"), true);
      setCompanions((prev) => addCompanionSuite(prev, "batt-select"));
    } else if (prefab === "flight-logger") {
      loadFromSource(getLayoutTemplateBoardSource("flight-logger"), true);
      setCompanions((prev) => addCompanionSuite(prev, "flight-logger"));
    } else {
      loadFromSource(getLayoutTemplateBoardSource(prefab, prefabLcd), true);
    }
  }, [templateId, hasRemoteWidget, loadFromSource, prefabLcd]);

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
        const snapshot =
          prev === source
            ? records
            : interpretDocument(prev, previewScenario);
        const byId = new Map(snapshot.map((r) => [r.id, r]));
        let next = prev;
        for (const id of ids) {
          const record = byId.get(id);
          if (!record) continue;
          next = updater(next, record);
        }
        return next;
      }, opts);
      markDirty();
    },
    [setSource, markDirty, previewScenario, source, records],
  );

  const handleTranslate = useCallback(
    (ids: string[], dx: number, dy: number) => {
      if (dx === 0 && dy === 0) return;
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

  const handleAddFullRfHeliElectric = useCallback(() => {
    // Starter has 2 draw records; confirm when the board already has work.
    const busy = source.includes("-- prefab:") || records.length > 2;
    if (
      busy &&
      !window.confirm(
        "Add all 6 RF heli sections to this board? Existing elements stay; prefabs are appended.",
      )
    ) {
      return;
    }
    setSource((prev) => {
      const { source: next } = insertPrefabSections(
        prev,
        [...ROTORFLIGHT_ELECTRIC_LAYOUT_ORDER],
        prefabLcd,
      );
      return next;
    });
    markDirty();
  }, [setSource, markDirty, source, records, prefabLcd]);

  const handleAddRfHeliNitro = useCallback(() => {
    const busy = source.includes("-- prefab:") || records.length > 2;
    if (
      busy &&
      !window.confirm(
        "Add RF heli nitro sections (RX pack tiles + voltage bar)? Existing elements stay.",
      )
    ) {
      return;
    }
    setSource((prev) => {
      const { source: next } = insertPrefabSections(
        prev,
        [...ROTORFLIGHT_NITRO_LAYOUT_ORDER],
        prefabLcd,
      );
      return next;
    });
    markDirty();
  }, [setSource, markDirty, source, records, prefabLcd]);

  const handleAddQuadBoard = useCallback(
    (boardId: string) => {
      const order =
        boardId === "whoop"
          ? WHOOP_LAYOUT_ORDER
          : boardId === "freestyle-quad"
            ? FREESTYLE_LAYOUT_ORDER
            : boardId === "dense-crsf"
              ? DENSE_CRSF_LAYOUT_ORDER
              : MINIMAL_QUAD_LAYOUT_ORDER;
      const label =
        boardId === "whoop"
          ? "whoop"
          : boardId === "freestyle-quad"
            ? "freestyle"
            : boardId === "dense-crsf"
              ? "dense CRSF"
              : "minimal";
      const busy = source.includes("-- prefab:") || records.length > 2;
      if (
        busy &&
        !window.confirm(
          `Add ${order.length} ${label} sections to this board? Existing elements stay; prefabs are appended.`,
        )
      ) {
        return;
      }
      setSource((prev) => {
        const { source: next } = insertPrefabSections(prev, [...order], prefabLcd);
        return next;
      });
      markDirty();
    },
    [setSource, markDirty, source, records, prefabLcd],
  );

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

  const handleAddPrefab = useCallback(
    (prefabId: string) => {
      setSource((prev) => {
        const result = insertPrefabSection(prev, prefabId, prefabLcd);
        return result?.source ?? prev;
      });
      markDirty();
      if (prefabId === "rf-model-panel") {
        handleAddCompanionSuite("flights-count");
      }
      if (prefabId === "rf-motor-tiles") {
        handleAddCompanionSuite("motor-gate");
      }
    },
    [setSource, markDirty, handleAddCompanionSuite, prefabLcd],
  );

  const persistModelPngToWorkspace = useCallback(
    async (bytes: Uint8Array, fileName: string) => {
      const key = workspaceKey ?? sessionId;
      if (!key) return;
      const sd = modelPngToSdFile(bytes, fileName);
      const rel = `images/${sd.path.replace(/^IMAGES\//, "")}`;
      await fetch("/api/widget-companions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceKey: workspaceKey ?? undefined,
          sessionId: sessionId ?? undefined,
          files: [
            {
              relPath: rel,
              content: sd.content,
              encoding: "base64",
            },
          ],
        }),
      }).catch(() => {
        /* zip may still omit image; desktop extraFiles covers install */
      });
    },
    [workspaceKey, sessionId],
  );

  const handleModelPngChange = useCallback(
    async (file: File | null) => {
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
      void persistModelPngToWorkspace(buf, file.name);
    },
    [persistModelPngToWorkspace],
  );

  const modelPngUrl = useMemo(() => {
    if (!modelPngBytes) return null;
    const copy = new Uint8Array(modelPngBytes);
    const blob = new Blob([copy], { type: "image/png" });
    return URL.createObjectURL(blob);
  }, [modelPngBytes]);

  useEffect(() => {
    if (!modelPngUrl) return;
    return () => URL.revokeObjectURL(modelPngUrl);
  }, [modelPngUrl]);

  const installExtraFiles = useMemo(() => {
    const files = companionFilesToSd(companions.files);
    if (modelPngBytes && modelPngName) {
      files.push(modelPngToSdFile(modelPngBytes, modelPngName));
    }
    return files;
  }, [companions.files, modelPngBytes, modelPngName]);

  const companionLabels = useMemo(
    () =>
      companions.suites
        .map((id) => getCompanionSuite(id)?.label)
        .filter((label): label is string => Boolean(label)),
    [companions.suites],
  );

  const installMd = useMemo(() => {
    const profile = getSimulateLayoutProfile(layoutProfileId);
    return formatInstallGuideMarkdown(
      buildInstallGuide(protocol, meta.name, {
        radioName:
          radioDisplayName ?? searchParams.get("radioName") ?? undefined,
        lcdW: profile.lcdW,
        lcdH: profile.lcdH,
        touch: radioTouch,
      }),
    );
  }, [
    protocol,
    meta.name,
    layoutProfileId,
    searchParams,
    radioTouch,
    radioDisplayName,
  ]);

  const handleEnrichChange = useCallback(
    (enabled: boolean) => {
      setEnrichRotorflight(enabled);
      writeEnrichRotorflightPreference(enabled);
      liveHandleRef.current?.setEnrichRotorflight(enabled);
      if (liveTelemetryActive && protocol === "rotorflight") {
        setLiveTelemetryNote(
          enabled
            ? "Live radio · enrich ON — HSpd/Gov/Vbec filled until rf2bg sensors appear"
            : "Live radio · enrich OFF — wire CRSF sensors only",
        );
      }
    },
    [liveTelemetryActive, protocol],
  );

  const handleAlign = useCallback(
    (mode: string) => {
      if (selectedIds.length < 1) return;
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
      saveProjectCompanions(id, companions);
      if (modelPngBytes) {
        saveProjectModelImage(
          id,
          modelPngToSdFile(modelPngBytes, modelPngName ?? "simmodel.png"),
        );
      }
      saveNamedVersion(id, name, source);
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
      companions,
      modelPngBytes,
      modelPngName,
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
      if (project?.workspaceKey) setWorkspaceKey(project.workspaceKey);
      const companionsPack = loadProjectCompanions(id);
      if (companionsPack) setCompanions(companionsPack);
      const model = loadProjectModelImage(id);
      if (model?.encoding === "base64" && model.content) {
        try {
          const bin = atob(model.content);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          setModelPngBytes(bytes);
          setModelPngName(model.path.split("/").pop() ?? "simmodel.png");
        } catch {
          /* ignore */
        }
      }
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
      setLiveWireKeys([]);
      setLiveEnrichKeys([]);
      setLiveTelemetryNote(null);
      return;
    }
    try {
      const handle = await openLiveTelemetryPort(
        (values, meta) => {
          setLiveTelemetryValues(values);
          const wireKeys = meta?.wireKeys ?? Object.keys(values);
          const enrichKeys = meta?.enrichKeys ?? [];
          setLiveWireKeys(wireKeys);
          setLiveEnrichKeys(enrichKeys);
          setLiveTelemetryNote(
            wireKeys.length
              ? `Live radio · ${wireKeys.slice(0, 6).join(", ")}${wireKeys.length > 6 ? "…" : ""} (canvas + sim)`
              : "Live radio · waiting for CRSF frames",
          );
        },
        { enrichRotorflight },
      );
      liveHandleRef.current = handle;
      setLiveTelemetryActive(true);
      setLiveTelemetryNote(
        protocol === "rotorflight"
          ? enrichRotorflight
            ? "Live radio · CRSF on wire; enrich ON — HSpd/Gov/Vbec filled until rf2bg"
            : "Live radio · CRSF on wire; enrich OFF — wire sensors only"
          : "Live radio · waiting for CRSF frames",
      );
    } catch (err) {
      setLiveTelemetryNote(
        err instanceof Error ? err.message : "Failed to open serial port",
      );
    }
  }, [liveTelemetryActive, protocol, enrichRotorflight]);

  const discoveredSensors = useMemo(() => {
    if (!liveTelemetryActive) return [] as string[];
    return liveWireKeys;
  }, [liveTelemetryActive, liveWireKeys]);

  const enrichOnlySensors = useMemo(() => {
    if (!liveTelemetryActive || !enrichRotorflight) return [] as string[];
    return liveEnrichKeys;
  }, [liveTelemetryActive, enrichRotorflight, liveEnrichKeys]);

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

  const handleClearAllLayers = useCallback(() => {
    if (records.length === 0) return;
    if (
      !window.confirm(
        `Remove all ${records.length} layer${records.length === 1 ? "" : "s"} from this board?`,
      )
    ) {
      return;
    }
    handleDeleteIds(records.map((r) => r.id));
  }, [records, handleDeleteIds]);

  const handleDuplicateSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    setSource((prev) => {
      let next = prev;
      for (const id of selectedIds) {
        const record = interpretDocument(next, previewScenario).find(
          (r) => r.id === id,
        );
        if (!record) continue;
        next = duplicateRecordLine(next, record);
      }
      return next;
    });
    markDirty();
  }, [selectedIds, setSource, previewScenario, markDirty]);

  const handleMoveLayer = useCallback(
    (id: string, dir: -1 | 1) => {
      setSource((prev) => {
        const record = interpretDocument(prev, previewScenario).find(
          (r) => r.id === id,
        );
        if (!record) return prev;
        return moveRecordLine(prev, record, dir);
      });
      markDirty();
    },
    [setSource, previewScenario, markDirty],
  );

  const handleReorderLayer = useCallback(
    (draggedId: string, targetId: string, place: "before" | "after") => {
      // Panel is front→back (reversed source). Visual "before" (above) =
      // later in source / in front of target.
      const sourcePlace = place === "before" ? "after" : "before";
      const live = interpretDocument(source, previewScenario);
      const moving = live.find((r) => r.id === draggedId);
      const target = live.find((r) => r.id === targetId);
      if (!moving || !target) return;
      const fromLine = moving.sourceRef?.sourceLine ?? moving.sourceLine;
      if (!fromLine) return;
      const lineText = getSourceLine(source, fromLine);
      const next = reorderRecordLine(source, moving, target, sourcePlace);
      if (next === source) return;
      setSource(next);
      markDirty();
      const after = interpretDocument(next, previewScenario);
      const match = after.find((r) => {
        const line = r.sourceRef?.sourceLine ?? r.sourceLine;
        return line != null && getSourceLine(next, line) === lineText;
      });
      setSelectedIds(match ? [match.id] : []);
    },
    [source, previewScenario, setSource, markDirty],
  );

  const lineTextsForIds = useCallback(
    (ids: string[], fromSource: string) => {
      const live = interpretDocument(fromSource, previewScenario);
      return ids
        .map((id) => {
          const r = live.find((row) => row.id === id);
          const line = r?.sourceRef?.sourceLine ?? r?.sourceLine;
          if (line == null) return null;
          return getSourceLine(fromSource, line);
        })
        .filter((t): t is string => t != null);
    },
    [previewScenario],
  );

  const handleNudgeLayerOrder = useCallback(
    (ids: string[], dir: -1 | 1) => {
      if (ids.length === 0) return;
      setSource((prev) => {
        let next = prev;
        const texts = lineTextsForIds(ids, next);
        const ordered =
          dir === 1
            ? texts.toReversed() // front-first when bringing forward
            : texts;
        for (const text of ordered) {
          const current = findRecordByLineText(next, text, previewScenario);
          if (!current) continue;
          next = moveRecordLine(next, current, dir);
        }
        return next;
      });
      markDirty();
    },
    [lineTextsForIds, previewScenario, setSource, markDirty],
  );

  const handleBringToFront = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      setSource((prev) => {
        let next = prev;
        // Back→front so relative order among the selection is preserved.
        for (const text of lineTextsForIds(ids, next)) {
          const live = interpretDocument(next, previewScenario);
          const current = findRecordByLineText(next, text, previewScenario);
          const last = live[live.length - 1];
          if (!current || !last || current.id === last.id) continue;
          next = reorderRecordLine(next, current, last, "after");
        }
        return next;
      });
      markDirty();
    },
    [lineTextsForIds, previewScenario, setSource, markDirty],
  );

  const handleSendToBack = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      setSource((prev) => {
        let next = prev;
        // Front→back so relative order among the selection is preserved.
        for (const text of lineTextsForIds(ids, next).toReversed()) {
          const live = interpretDocument(next, previewScenario);
          const current = findRecordByLineText(next, text, previewScenario);
          const first = live[0];
          if (!current || !first || current.id === first.id) continue;
          next = reorderRecordLine(next, current, first, "before");
        }
        return next;
      });
      markDirty();
    },
    [lineTextsForIds, previewScenario, setSource, markDirty],
  );

  const handleSelectAll = useCallback(() => {
    setSelectedIds(records.map((r) => r.id));
  }, [records]);

  const openCanvasContextMenu = useCallback(
    (info: { clientX: number; clientY: number; hitId: string | null }) => {
      if (info.hitId) {
        setSelectedIds((prev) =>
          prev.includes(info.hitId!) ? prev : [info.hitId!],
        );
      } else {
        setSelectedIds([]);
      }
      setCanvasMenu({ x: info.clientX, y: info.clientY });
    },
    [],
  );

  const canvasContextItems = useMemo((): CanvasContextMenuItem[] => {
    const hasSelection = selectedIds.length > 0;
    const canAlign = selectedIds.length >= 1;
    const canDistribute = selectedIds.length >= 3;
    const items: CanvasContextMenuItem[] = [];

    if (hasSelection) {
      items.push(
        {
          id: "duplicate",
          label: "Duplicate",
          shortcut: modShortcut("D"),
          onClick: () => handleDuplicateSelected(),
        },
        {
          id: "delete",
          label: "Delete",
          shortcut: "Del",
          onClick: () => handleDeleteIds(selectedIds),
        },
        {
          id: "bring-forward",
          label: "Bring forward",
          separatorBefore: true,
          onClick: () => handleNudgeLayerOrder(selectedIds, 1),
        },
        {
          id: "send-backward",
          label: "Send backward",
          onClick: () => handleNudgeLayerOrder(selectedIds, -1),
        },
        {
          id: "bring-front",
          label: "Bring to front",
          onClick: () => handleBringToFront(selectedIds),
        },
        {
          id: "send-back",
          label: "Send to back",
          onClick: () => handleSendToBack(selectedIds),
        },
        {
          id: "align-left",
          label: "Align left",
          separatorBefore: true,
          disabled: !canAlign,
          onClick: () => handleAlign("left"),
        },
        {
          id: "align-center",
          label: "Align center",
          disabled: !canAlign,
          onClick: () => handleAlign("center-x"),
        },
        {
          id: "align-right",
          label: "Align right",
          disabled: !canAlign,
          onClick: () => handleAlign("right"),
        },
        {
          id: "align-top",
          label: "Align top",
          disabled: !canAlign,
          onClick: () => handleAlign("top"),
        },
        {
          id: "align-middle",
          label: "Align middle",
          disabled: !canAlign,
          onClick: () => handleAlign("center-y"),
        },
        {
          id: "align-bottom",
          label: "Align bottom",
          disabled: !canAlign,
          onClick: () => handleAlign("bottom"),
        },
      );
      if (canDistribute) {
        items.push(
          {
            id: "dist-h",
            label: "Distribute horizontally",
            separatorBefore: true,
            onClick: () => handleDistribute("horizontal"),
          },
          {
            id: "dist-v",
            label: "Distribute vertically",
            onClick: () => handleDistribute("vertical"),
          },
        );
      }
    }

    items.push({
      id: "select-all",
      label: "Select all",
      shortcut: modShortcut("A"),
      separatorBefore: items.length > 0,
      disabled: records.length === 0,
      onClick: () => handleSelectAll(),
    });

    if (hasSelection) {
      items.push({
        id: "deselect",
        label: "Deselect",
        shortcut: "Esc",
        onClick: () => setSelectedIds([]),
      });
    }

    items.push({
      id: "clear-all",
      label: "Clear all layers…",
      separatorBefore: true,
      disabled: records.length === 0,
      onClick: () => handleClearAllLayers(),
    });

    return items;
  }, [
    selectedIds,
    records.length,
    handleDuplicateSelected,
    handleDeleteIds,
    handleNudgeLayerOrder,
    handleBringToFront,
    handleSendToBack,
    handleAlign,
    handleDistribute,
    handleSelectAll,
    handleClearAllLayers,
  ]);

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
      source?: string;
    };
    if (body.source && body.source !== source) {
      replaceSource(body.source);
    }
    setValid(body.valid);
    setValidationIssues(body.issues ?? []);
  }, [source, protocol, replaceSource]);

  const handleSave = useCallback(async (): Promise<string | null> => {
    setSaving(true);
    setLoadError(null);
    try {
      const allocate = !workspaceKey && !sessionId;
      const res = await fetch("/api/widget-source", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          instanceId: workspaceKey,
          sessionId,
          protocol,
          radioId,
          allocate,
          ...(chatId ? { chatId } : {}),
        }),
      });
      const body = (await res.json()) as {
        valid: boolean;
        issues?: ValidationIssue[];
        error?: string;
        workspaceKey?: string;
        source?: string;
      };
      if (!res.ok) {
        setLoadError(body.error ?? `Save failed (${res.status})`);
        setValid(body.valid ?? false);
        setValidationIssues(body.issues ?? []);
        return null;
      }
      if (body.source && body.source !== source) {
        replaceSource(body.source);
        savedSourceRef.current = body.source;
      } else {
        savedSourceRef.current = source;
      }
      const nextKey = body.workspaceKey ?? workspaceKey;
      if (nextKey && nextKey !== workspaceKey) {
        setWorkspaceKey(nextKey);
      }
      setValid(body.valid);
      setValidationIssues(body.issues ?? []);
      setDirty(false);
      return nextKey ?? null;
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Save failed");
      return null;
    } finally {
      setSaving(false);
    }
  }, [workspaceKey, sessionId, source, protocol, radioId, chatId, replaceSource]);

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
        setExportOpen(false);
        setCanvasMenu(null);
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
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if (selectedIds.length === 0) return;
        e.preventDefault();
        handleDuplicateSelected();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        handleSelectAll();
        return;
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
    handleDuplicateSelected,
    handleSelectAll,
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
      <AppPreferencesHost />
      <AppChrome
        surface="layout"
        subtitle={subtitle}
        generateHref={
          chatId ? `/?chatId=${encodeURIComponent(chatId)}` : "/"
        }
        layoutHref={layoutSelfHref}
        actions={
          <>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={openSim}
            >
              <span className={styles.actionLabelFull}>Simulator</span>
              <span className={styles.actionLabelShort}>Sim</span>
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              title={
                valid === false
                  ? "Export package — fix validation errors before download"
                  : "Export zip or copy to SD card"
              }
              onClick={() => setExportOpen(true)}
            >
              <span className={styles.actionLabelFull}>Export</span>
              <span className={styles.actionLabelShort}>Export</span>
            </button>
            <EditorMenu
              label="More"
              variant="ghost"
              align="right"
              title="Copy, import, and preferences"
              items={[
                {
                  id: "copy",
                  label: copyDone ? "Copied" : "Copy Lua",
                  onClick: () => void handleCopyLua(),
                },
                {
                  id: "import",
                  label: "Import Lua…",
                  onClick: () => setPasteOpen(true),
                },
                {
                  id: "new",
                  label: "New board",
                  separatorBefore: true,
                  onClick: () => {
                    if (dirty && !window.confirm("Discard unsaved changes?"))
                      return;
                    loadFromSource(createStarterSource(), true);
                  },
                },
                {
                  id: "clear-all",
                  label: "Clear all layers…",
                  disabled: records.length === 0,
                  onClick: () => handleClearAllLayers(),
                },
                {
                  id: "prefs",
                  label: "Preferences…",
                  separatorBefore: true,
                  onClick: () => openAppPreferences(),
                },
              ]}
            />
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
        onAddFullRfHeliElectric={
          protocol === "rotorflight" ? handleAddFullRfHeliElectric : undefined
        }
        onAddRfHeliNitro={
          protocol === "rotorflight" ? handleAddRfHeliNitro : undefined
        }
        onAddQuadBoard={
          protocol === "betaflight" || protocol === "generic-crsf"
            ? handleAddQuadBoard
            : undefined
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
        previewScenarioId={previewScenarioId}
        onPreviewScenarioChange={setPreviewScenarioId}
        liveTelemetryActive={liveTelemetryActive}
        onToggleLiveTelemetry={handleToggleLiveTelemetry}
        liveTelemetrySupported={liveTelemetrySupported}
        enrichRotorflight={enrichRotorflight}
        onEnrichChange={handleEnrichChange}
        modelPngName={modelPngName}
        modelPngUrl={modelPngUrl}
        onModelPngChange={(file) => void handleModelPngChange(file)}
        showSnapGuides={showSnapGuides}
        onSnapGuidesChange={setShowSnapGuides}
        onAlign={handleAlign}
        onDistribute={handleDistribute}
        canAlign={selectedIds.length >= 1}
        canDistribute={selectedIds.length >= 3}
      />

      {protocol === "rotorflight" ? (
        <div className={styles.protocolCallout} role="status">
          Rotorflight: enable <strong>rf2bg</strong> (Special Function, Repeat
          On), then Telemetry → Discover new for HSpd / EscT / Vbec / Vcel /
          Gov. Insert → Full RF heli (electric) or RF heli nitro board.
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
                Enrich {enrichRotorflight ? "ON" : "OFF"} —{" "}
                {enrichRotorflight
                  ? "fills missing HSpd/Gov/Vbec (not true FC sensors until rf2bg + Discover new)."
                  : "showing wire CRSF sensors only."}
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
            onMoveUp={(id) => handleMoveLayer(id, 1)}
            onMoveDown={(id) => handleMoveLayer(id, -1)}
            onReorder={handleReorderLayer}
            onClearAll={handleClearAllLayers}
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
              showSnapGuides={showSnapGuides}
              scenarioId={previewScenarioId}
              scenarioOverride={
                liveTelemetryActive ? previewScenario : undefined
              }
              layoutProfileId={layoutProfileId}
              onContextMenu={openCanvasContextMenu}
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
            enrichOnlySensors={enrichOnlySensors}
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
            onApplyBackground={(nextSource) => {
              setSource(nextSource);
              markDirty();
            }}
            onBackgroundImageChange={async (file) => {
              if (!file) {
                setModelPngBytes(null);
                setModelPngName(null);
                return;
              }
              if (file.type !== "image/png") {
                window.alert("Background image must be a PNG.");
                return;
              }
              const buf = new Uint8Array(await file.arrayBuffer());
              setModelPngBytes(buf);
              setModelPngName("dashbg.png");
              void persistModelPngToWorkspace(buf, "dashbg.png");
              setSource((prev) =>
                applyDashboardBackground(prev, {
                  mode: "image",
                  imagePath: DEFAULT_BG_IMAGE_PATH,
                }),
              );
              markDirty();
            }}
            backgroundImageName={modelPngName}
            backgroundImageUrl={modelPngUrl}
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

      <ExportInstallModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        widgetName={meta.name}
        luaSource={source}
        installMd={installMd}
        workspaceKey={workspaceKey}
        sessionId={sessionId}
        protocol={protocol}
        radioId={radioId}
        extraFiles={installExtraFiles}
        companionLabels={companionLabels}
        hasModelImage={
          Boolean(modelPngBytes) || /drawBitmap|Bitmap\.open/.test(source)
        }
        radioName={radioDisplayName ?? undefined}
        lcdW={getSimulateLayoutProfile(layoutProfileId).lcdW}
        lcdH={getSimulateLayoutProfile(layoutProfileId).lcdH}
        touch={radioTouch}
        validationErrorCount={
          validationIssues.filter((i) => i.severity === "error").length
        }
        onBeforeDownload={async () => {
          if (dirty || (!workspaceKey && !sessionId)) {
            return handleSave();
          }
          return workspaceKey;
        }}
        onReviewValidation={() => {
          setMobileTab("properties");
          const first = validationIssues.find(
            (i) => i.severity === "error" && i.line != null,
          );
          if (first) selectIssue(first);
        }}
      />

      <CanvasContextMenu
        open={canvasMenu != null}
        x={canvasMenu?.x ?? 0}
        y={canvasMenu?.y ?? 0}
        items={canvasContextItems}
        onClose={() => setCanvasMenu(null)}
      />

      <SimVerifyModal
        source={source}
        open={simOpen}
        onClose={() => setSimOpen(false)}
        reloadKey={simReloadKey}
        onReload={() => setSimReloadKey((k) => k + 1)}
        scenarioId={previewScenarioId}
        scenarioOverride={liveTelemetryActive ? previewScenario : undefined}
        layoutProfileId={layoutProfileId}
        radioId={radioId}
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
