"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  createDefaultElement,
  createEmptyScene,
  luaToScene,
  newElementId,
  sceneToLua,
  type EditorElement,
  type ElementKind,
} from "@widget-gen/editor-core";
import type { ValidationIssue } from "@widget-gen/shared";
import { usePreviewLua } from "./hooks/useEditorSim";
import { useUndoStack } from "./hooks/useUndoStack";
import { EditorCanvas } from "./components/EditorCanvas";
import { LayersPanel } from "./components/LayersPanel";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { EditorToolbar } from "./components/EditorToolbar";
import styles from "./editor.module.css";

export function EditorApp() {
  const searchParams = useSearchParams();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [valid, setValid] = useState<boolean | null>(null);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [saving, setSaving] = useState(false);
  const [workspaceKey, setWorkspaceKey] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");

  const [simFlushNonce, setSimFlushNonce] = useState(0);
  /** Original Lua from URL/import — used for WASM preview until the user edits. */
  const [baselineSource, setBaselineSource] = useState<string | null>(null);
  const [previewUsesScene, setPreviewUsesScene] = useState(false);
  const [remoteLoadPending, setRemoteLoadPending] = useState(false);

  const { scene, setScene, replaceScene, undo, redo, canUndo, canRedo } = useUndoStack(
    createEmptyScene()
  );

  const markPreviewDirty = useCallback(() => {
    setPreviewUsesScene(true);
  }, []);

  const previewLua = usePreviewLua(scene, baselineSource, previewUsesScene);

  const loadFromSource = useCallback(
    (source: string) => {
      const { scene: imported, warnings } = luaToScene(source);
      setBaselineSource(source);
      setPreviewUsesScene(false);
      replaceScene(imported);
      setImportWarnings(warnings);
      setSelectedIds([]);
      setValid(null);
      setValidationIssues([]);
      setSimFlushNonce((n) => n + 1);
    },
    [replaceScene]
  );

  const bumpSimReload = useCallback(() => {
    setSimFlushNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    const instanceId = searchParams.get("instanceId");
    const name = searchParams.get("name");
    const sid = searchParams.get("sessionId");
    setSessionId(sid);

    if (!instanceId && !name && !sid) {
      setRemoteLoadPending(false);
      return;
    }

    setRemoteLoadPending(true);

    const params = new URLSearchParams();
    if (sid) params.set("sessionId", sid);
    if (instanceId) params.set("instanceId", instanceId);
    if (name) params.set("name", name);

    void fetch(`/api/widget-source?${params}`)
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 204) throw new Error("Widget not found");
          throw new Error(`Load failed (${res.status})`);
        }
        const source = await res.text();
        const wk =
          res.headers.get("X-Widget-Instance-Id") ?? instanceId ?? name ?? sid ?? "";
        setWorkspaceKey(wk);
        loadFromSource(source);
      })
      .catch((err: Error) => setLoadError(err.message))
      .finally(() => setRemoteLoadPending(false));
  }, [searchParams, loadFromSource]);

  const selectedElements = useMemo(
    () => scene.elements.filter((el) => selectedIds.includes(el.id)),
    [scene.elements, selectedIds]
  );

  const updateElements = useCallback(
    (updater: (elements: EditorElement[]) => EditorElement[]) => {
      setScene((prev) => ({ ...prev, elements: updater(prev.elements) }));
      setValid(null);
      markPreviewDirty();
    },
    [setScene, markPreviewDirty]
  );

  const patchElement = useCallback(
    (id: string, patch: Partial<EditorElement>) => {
      updateElements((els) =>
        els.map((el) => (el.id === id ? ({ ...el, ...patch } as EditorElement) : el))
      );
      bumpSimReload();
    },
    [updateElements, bumpSimReload]
  );

  const handleAdd = useCallback(
    (kind: ElementKind) => {
      const el = createDefaultElement(kind, newElementId(kind));
      setScene((prev) => ({ ...prev, elements: [...prev.elements, el] }));
      setSelectedIds([el.id]);
      setValid(null);
      markPreviewDirty();
      bumpSimReload();
    },
    [setScene, markPreviewDirty, bumpSimReload]
  );

  const handleUndo = useCallback(() => {
    undo();
    markPreviewDirty();
    bumpSimReload();
  }, [undo, markPreviewDirty, bumpSimReload]);

  const handleRedo = useCallback(() => {
    redo();
    markPreviewDirty();
    bumpSimReload();
  }, [redo, markPreviewDirty, bumpSimReload]);

  const exportSource = useCallback(() => {
    if (!previewUsesScene && baselineSource) return baselineSource;
    return sceneToLua(scene);
  }, [previewUsesScene, baselineSource, scene]);

  const handleValidate = useCallback(async () => {
    const source = exportSource();
    const res = await fetch("/api/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source, protocol: "betaflight" }),
    });
    if (!res.ok) {
      setValid(false);
      return;
    }
    const body = (await res.json()) as { valid: boolean; issues: ValidationIssue[] };
    setValid(body.valid);
    setValidationIssues(body.issues ?? []);
  }, [exportSource]);

  const handleSave = useCallback(async () => {
    if (!workspaceKey && !sessionId) {
      setLoadError("No workspace to save to — load a widget via URL or paste Lua first");
      return;
    }
    setSaving(true);
    setLoadError(null);
    try {
      const source = exportSource();
      const res = await fetch("/api/widget-source", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          instanceId: workspaceKey,
          sessionId,
          protocol: "betaflight",
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
      setBaselineSource(source);
      setPreviewUsesScene(false);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [workspaceKey, sessionId, exportSource]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
      if (e.key === "Escape") setPasteOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleUndo, handleRedo]);

  return (
    <div className={styles.editorRoot}>
      <header className={styles.editorHeader}>
        <div className={styles.brand}>
          <Link href="/" className={styles.logo} aria-label="Back to generator">
            ET
          </Link>
          <div className={styles.brandCopy}>
            <h1 className={styles.editorTitle}>Dashboard Editor</h1>
            <p className={styles.editorSubtitle}>
              <span>{scene.name || "Untitled"}</span>
              <span className={styles.dot} aria-hidden>
                ·
              </span>
              <span>
                {scene.simulate.layout} z{scene.simulate.zone}
              </span>
            </p>
          </div>
        </div>
        <div className={styles.headerActions}>
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
              replaceScene(createEmptyScene());
              setBaselineSource(null);
              setPreviewUsesScene(false);
              setSelectedIds([]);
              setValid(null);
              setSimFlushNonce((n) => n + 1);
            }}
          >
            New
          </button>
        </div>
      </header>

      {(loadError || importWarnings.length > 0) && (
        <div className={styles.bannerStack}>
          {loadError && (
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
          )}
          {importWarnings.length > 0 && (
            <div className={styles.warnBanner}>
              <strong>Import notes</strong>
              <ul>
                {importWarnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <EditorToolbar
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onAdd={handleAdd}
        onSave={handleSave}
        onValidate={handleValidate}
        saving={saving}
        valid={valid}
      />

      <div className={styles.editorBody}>
        <LayersPanel
          elements={scene.elements}
          selectedIds={selectedIds}
          onSelect={(id, additive) =>
            setSelectedIds((prev) =>
              additive ? (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]) : [id]
            )
          }
          onReorder={(from, to) => {
            if (to < 0 || to >= scene.elements.length) return;
            setScene((prev) => {
              const next = [...prev.elements];
              const [item] = next.splice(from, 1);
              next.splice(to, 0, item!);
              return { ...prev, elements: next };
            });
            markPreviewDirty();
            bumpSimReload();
          }}
          onToggleVisible={(id) =>
            updateElements((els) =>
              els.map((el) => (el.id === id ? { ...el, visible: !el.visible } : el))
            )
          }
          onDelete={(id) => {
            updateElements((els) => els.filter((el) => el.id !== id));
            setSelectedIds((prev) => prev.filter((x) => x !== id));
          }}
        />

        <EditorCanvas
          luaSource={previewLua}
          simReady={!remoteLoadPending}
          simFlushNonce={simFlushNonce}
          elements={scene.elements}
          selectedIds={selectedIds}
          onSelect={setSelectedIds}
          onElementsChange={updateElements}
          onInteractionEnd={() => setSimFlushNonce((n) => n + 1)}
        />

        <div className={styles.rightColumn}>
          <PropertiesPanel
            scene={scene}
            selectedElements={selectedElements}
            onUpdateElement={patchElement}
            onUpdateScene={(patch) => {
              setScene((prev) => ({ ...prev, ...patch }));
              markPreviewDirty();
              bumpSimReload();
            }}
          />
          {validationIssues.length > 0 && (
            <div className={styles.validationPanel}>
              <h3 className={styles.sectionTitle}>Validation</h3>
              <ul className={styles.validationList}>
                {validationIssues.map((issue, i) => (
                  <li key={`${issue.message}-${i}`} data-severity={issue.severity}>
                    {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {pasteOpen && (
        <div className={styles.modalBackdrop} role="presentation" onClick={() => setPasteOpen(false)}>
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
              Paste an EdgeTX widget <code>main.lua</code> to convert it into editable layers.
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
              <button type="button" className={styles.ghostBtn} onClick={() => setPasteOpen(false)}>
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
