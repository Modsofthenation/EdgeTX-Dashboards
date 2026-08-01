"use client";

import { useEffect, useRef, useState } from "react";
import type { ProjectSummary } from "~/lib/projectLibrary";
import {
  downloadProjectPack,
  exportProjectPack,
  importProjectPack,
  listRecentProjects,
  parseProjectPack,
  projectSummaryFromPack,
} from "~/lib/projectLibrary";
import {
  isTauriDesktop,
  listAppDataProjects,
  openProjectPackFromDisk,
  readAppDataProject,
  saveProjectPackToAppData,
  saveProjectPackToDisk,
} from "~/lib/desktopProjectIo";
import styles from "../editor.module.css";

export type ProjectLibraryMode = "save" | "recent";
const APP_DATA_MIGRATION_KEY = "edgetx.projectLibrary.appDataMigrated.v1";

interface ProjectLibraryModalProps {
  open: boolean;
  mode: ProjectLibraryMode;
  defaultName?: string;
  projectId?: string | null;
  onClose: () => void;
  onSave: (name: string) => void | Promise<void>;
  onOpen: (id: string, appDataFileName?: string) => void | Promise<void>;
  onRename?: (
    id: string,
    name: string,
    appDataFileNames?: string[],
  ) => void | Promise<void>;
  onDelete?: (id: string, appDataFileNames?: string[]) => void | Promise<void>;
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
  const [recent, setRecent] = useState<ProjectSummary[]>([]);
  const [appDataFiles, setAppDataFiles] = useState<Record<string, string[]>>(
    {},
  );
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && mode === "save") setName(defaultName);
    if (!open) return;
    setRenameId(null);
    setDiskNote(null);

    let cancelled = false;
    const localProjects = listRecentProjects();
    if (mode === "recent") setRecent(localProjects);

    void (async () => {
      const isDesktop = await isTauriDesktop();
      if (cancelled) return;
      setDesktop(isDesktop);
      if (!isDesktop || mode !== "recent") return;

      try {
        let files = await listAppDataProjects();
        let migrationDone = false;
        try {
          migrationDone = localStorage.getItem(APP_DATA_MIGRATION_KEY) === "1";
        } catch {
          // Storage access must not hide app-data projects.
        }
        if (!migrationDone && files.length === 0 && localProjects.length > 0) {
          const packs = localProjects
            .map((project) => exportProjectPack(project.id))
            .filter((pack) => pack != null);
          let migrationOk = packs.length === localProjects.length;
          for (const pack of packs) {
            const result = await saveProjectPackToAppData(
              pack.project.id,
              JSON.stringify(pack, null, 2),
            );
            if ("error" in result) {
              migrationOk = false;
              if (!cancelled) setDiskNote(result.error);
              break;
            }
          }
          if (migrationOk) {
            try {
              localStorage.setItem(APP_DATA_MIGRATION_KEY, "1");
            } catch {
              // The migration succeeded even if its browser marker cannot persist.
            }
            files = await listAppDataProjects();
          }
        }

        const appProjects: ProjectSummary[] = [];
        const fileNames: Record<string, string[]> = {};
        for (const file of files) {
          try {
            const json = await readAppDataProject(file.fileName);
            const parsed = parseProjectPack(JSON.parse(json) as unknown);
            if ("error" in parsed) continue;
            const summary = projectSummaryFromPack(
              parsed.pack,
              file.modifiedMs,
            );
            if (!summary) continue;
            fileNames[summary.id] = [
              ...(fileNames[summary.id] ?? []),
              file.fileName,
            ];
            if (fileNames[summary.id].length > 1) continue;
            appProjects.push(summary);
          } catch {
            // One corrupt pack must not hide the rest of the library.
          }
        }
        if (cancelled) return;
        const merged = new Map(
          localProjects.map((project) => [project.id, project]),
        );
        for (const project of appProjects) merged.set(project.id, project);
        setRecent(
          [...merged.values()].sort((a, b) =>
            b.updatedAt.localeCompare(a.updatedAt),
          ),
        );
        setAppDataFiles(fileNames);
      } catch (err) {
        if (!cancelled) {
          setDiskNote(
            err instanceof Error
              ? err.message
              : "Could not load app-data projects.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, mode, defaultName, listTick]);

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
    const result = await saveProjectPackToAppData(
      pack.project.id,
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
              Named boards store Lua, companion suites, model PNG, and a named
              version snapshot in this browser. Export a pack JSON to share
              across machines (desktop can also save to disk / app data).
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
                    if (trimmed) void onSave(trimmed);
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
                onClick={() => void onSave(name.trim())}
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
                          onClick={async () => {
                            await onRename?.(
                              p.id,
                              renameDraft,
                              appDataFiles[p.id],
                            );
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
                          onClick={() =>
                            void onOpen(p.id, appDataFiles[p.id]?.[0])
                          }
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
                            onClick={async () => {
                              if (
                                window.confirm(`Delete project “${p.name}”?`)
                              ) {
                                await onDelete?.(p.id, appDataFiles[p.id]);
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
