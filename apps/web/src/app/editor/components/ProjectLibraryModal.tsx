"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ProjectSummary } from "~/lib/projectLibrary";
import {
  downloadProjectPack,
  exportProjectPack,
  importProjectPack,
  listRecentProjects,
} from "~/lib/projectLibrary";
import {
  isTauriDesktop,
  openProjectPackFromDisk,
  saveProjectPackToDisk,
  syncProjectPackToAppData,
} from "~/lib/desktopProjectIo";
import styles from "../editor.module.css";

export type ProjectLibraryMode = "save" | "recent";

interface ProjectLibraryModalProps {
  open: boolean;
  mode: ProjectLibraryMode;
  defaultName?: string;
  projectId?: string | null;
  onClose: () => void;
  onSave: (name: string) => void;
  onOpen: (id: string) => void;
  onRename?: (id: string, name: string) => void;
  onDelete?: (id: string) => void;
  onImported?: (id: string) => void;
}

export function ProjectLibraryModal({
  open,
  mode,
  defaultName = "Dashboard",
  projectId = null,
  onClose,
  onSave,
  onOpen,
  onRename,
  onDelete,
  onImported,
}: ProjectLibraryModalProps) {
  const [name, setName] = useState(defaultName);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [listTick, setListTick] = useState(0);
  const [desktop, setDesktop] = useState(false);
  const [diskNote, setDiskNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recent = useMemo(
    () => (open && mode === "recent" ? listRecentProjects() : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- listTick forces refresh after mutate
    [open, mode, listTick],
  );

  useEffect(() => {
    if (open && mode === "save") setName(defaultName);
    if (open) {
      setRenameId(null);
      setDiskNote(null);
      setListTick((t) => t + 1);
      void isTauriDesktop().then(setDesktop);
    }
  }, [open, mode, defaultName]);

  if (!open) return null;

  const saveCurrentToDisk = async (id: string) => {
    const pack = exportProjectPack(id);
    if (!pack) {
      setDiskNote("Save the project in-browser first (needs Lua source).");
      return;
    }
    const result = await saveProjectPackToDisk(
      pack.project.name,
      JSON.stringify(pack, null, 2),
    );
    if ("cancelled" in result) return;
    if ("error" in result) {
      setDiskNote(result.error);
      return;
    }
    setDiskNote(`Saved to ${result.path}`);
  };

  const syncCurrentToAppData = async (id: string) => {
    const pack = exportProjectPack(id);
    if (!pack) {
      setDiskNote("Save the project in-browser first (needs Lua source).");
      return;
    }
    const fileName = `${pack.project.name.replace(/[^\w.-]+/g, "_") || "dashboard"}.edgetx-project.json`;
    const result = await syncProjectPackToAppData(
      fileName,
      JSON.stringify(pack, null, 2),
    );
    if ("error" in result) {
      setDiskNote(result.error);
      return;
    }
    setDiskNote(`Synced to app data: ${result.path}`);
  };

  const openFromDisk = async () => {
    const result = await openProjectPackFromDisk();
    if ("cancelled" in result) return;
    if ("error" in result) {
      setDiskNote(result.error);
      return;
    }
    try {
      const parsed = JSON.parse(result.json) as unknown;
      const imported = importProjectPack(parsed);
      if ("error" in imported) {
        setDiskNote(imported.error);
        return;
      }
      setListTick((t) => t + 1);
      setDiskNote(`Opened ${result.path}`);
      onImported?.(imported.project.id);
    } catch {
      setDiskNote("Could not parse project pack JSON.");
    }
  };

  return (
    <div className={styles.modalBackdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-library-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHead}>
          <h2 id="project-library-title" className={styles.modalTitle}>
            {mode === "save" ? "Save project as…" : "Recent projects"}
          </h2>
          <button
            type="button"
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {mode === "save" ? (
          <>
            <p className={styles.modalHint}>
              Named boards are stored in this browser (and desktop app). On
              desktop, also save to a folder or app data for a durable copy.
            </p>
            <label className={styles.projectField}>
              <span className={styles.projectFieldLabel}>Name</span>
              <input
                className={styles.projectInput}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const trimmed = name.trim();
                    if (trimmed) onSave(trimmed);
                  }
                }}
              />
            </label>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={!name.trim()}
                onClick={() => onSave(name.trim())}
              >
                Save
              </button>
            </div>
            {desktop && projectId ? (
              <div className={styles.projectToolbar}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => void saveCurrentToDisk(projectId)}
                >
                  Save to disk…
                </button>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => void syncCurrentToAppData(projectId)}
                >
                  Sync to app data
                </button>
              </div>
            ) : null}
            {diskNote ? <p className={styles.modalHint}>{diskNote}</p> : null}
          </>
        ) : (
          <>
            <div className={styles.projectToolbar}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => fileRef.current?.click()}
              >
                Import pack…
              </button>
              {desktop ? (
                <>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => void openFromDisk()}
                  >
                    Open from disk…
                  </button>
                  {projectId ? (
                    <>
                      <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={() => void saveCurrentToDisk(projectId)}
                      >
                        Save current to disk…
                      </button>
                      <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={() => void syncCurrentToAppData(projectId)}
                      >
                        Sync to app data
                      </button>
                    </>
                  ) : null}
                </>
              ) : null}
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  try {
                    const parsed = JSON.parse(await file.text()) as unknown;
                    const result = importProjectPack(parsed);
                    if ("error" in result) {
                      window.alert(result.error);
                      return;
                    }
                    setListTick((t) => t + 1);
                    onImported?.(result.project.id);
                  } catch {
                    window.alert("Could not read project pack JSON.");
                  }
                }}
              />
            </div>
            {diskNote ? <p className={styles.modalHint}>{diskNote}</p> : null}
            {recent.length === 0 ? (
              <p className={styles.modalHint}>
                No recent projects yet — use Save as… first, or Import a pack.
              </p>
            ) : (
              <ul className={styles.projectList}>
                {recent.map((p: ProjectSummary) => (
                  <li key={p.id} className={styles.projectListRow}>
                    {renameId === p.id ? (
                      <div className={styles.projectRenameRow}>
                        <input
                          className={styles.projectInput}
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          autoFocus
                        />
                        <button
                          type="button"
                          className={styles.primaryBtn}
                          onClick={() => {
                            onRename?.(p.id, renameDraft);
                            setRenameId(null);
                            setListTick((t) => t + 1);
                          }}
                        >
                          OK
                        </button>
                        <button
                          type="button"
                          className={styles.secondaryBtn}
                          onClick={() => setRenameId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          className={styles.projectListBtn}
                          onClick={() => onOpen(p.id)}
                        >
                          <span className={styles.projectListName}>
                            {p.name}
                          </span>
                          <span className={styles.projectListMeta}>
                            {p.protocol}
                            {p.radioId ? ` · ${p.radioId}` : ""} ·{" "}
                            {new Date(p.updatedAt).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </button>
                        <div className={styles.projectRowActions}>
                          <button
                            type="button"
                            className={styles.ghostBtn}
                            title="Rename"
                            onClick={() => {
                              setRenameId(p.id);
                              setRenameDraft(p.name);
                            }}
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            className={styles.ghostBtn}
                            title="Export pack"
                            onClick={() => {
                              if (!downloadProjectPack(p.id)) {
                                window.alert("No Lua saved for this project.");
                              }
                            }}
                          >
                            Export
                          </button>
                          {desktop ? (
                            <button
                              type="button"
                              className={styles.ghostBtn}
                              title="Save to disk"
                              onClick={() => void saveCurrentToDisk(p.id)}
                            >
                              Disk
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className={styles.ghostBtn}
                            title="Delete"
                            onClick={() => {
                              if (
                                window.confirm(`Delete project “${p.name}”?`)
                              ) {
                                onDelete?.(p.id);
                                setListTick((t) => t + 1);
                              }
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
