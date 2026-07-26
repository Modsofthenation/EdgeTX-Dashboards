"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProjectSummary } from "~/lib/projectLibrary";
import { listRecentProjects } from "~/lib/projectLibrary";
import styles from "../editor.module.css";

export type ProjectLibraryMode = "save" | "recent";

interface ProjectLibraryModalProps {
  open: boolean;
  mode: ProjectLibraryMode;
  defaultName?: string;
  onClose: () => void;
  onSave: (name: string) => void;
  onOpen: (id: string) => void;
}

export function ProjectLibraryModal({
  open,
  mode,
  defaultName = "Dashboard",
  onClose,
  onSave,
  onOpen,
}: ProjectLibraryModalProps) {
  const [name, setName] = useState(defaultName);
  const recent = useMemo(
    () => (open && mode === "recent" ? listRecentProjects() : []),
    [open, mode],
  );

  useEffect(() => {
    if (open && mode === "save") setName(defaultName);
  }, [open, mode, defaultName]);

  if (!open) return null;

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
              Named boards are stored in this browser (and desktop app) for
              Recent / Open last.
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
          </>
        ) : (
          <>
            {recent.length === 0 ? (
              <p className={styles.modalHint}>
                No recent projects yet — use Save as… first.
              </p>
            ) : (
              <ul className={styles.projectList}>
                {recent.map((p: ProjectSummary) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={styles.projectListBtn}
                      onClick={() => onOpen(p.id)}
                    >
                      <span className={styles.projectListName}>{p.name}</span>
                      <span className={styles.projectListMeta}>
                        {p.protocol} ·{" "}
                        {new Date(p.updatedAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </button>
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
