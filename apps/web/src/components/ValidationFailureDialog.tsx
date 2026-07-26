"use client";

import { useEffect, useId, useRef } from "react";
import type { DownloadValidationFailure } from "~/lib/downloadValidation";
import styles from "./ValidationFailureDialog.module.css";

export type {
  DownloadValidationFailure,
  DownloadValidationIssue,
} from "~/lib/downloadValidation";
export { parseDownloadValidationFailure } from "~/lib/downloadValidation";

interface ValidationFailureDialogProps {
  open: boolean;
  failure: DownloadValidationFailure | null;
  onClose: () => void;
  /** Optional: jump to first error in the editor */
  onReview?: () => void;
}

export function ValidationFailureDialog({
  open,
  failure,
  onClose,
  onReview,
}: ValidationFailureDialogProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !failure) return null;

  const errors = failure.issues.filter((i) => i.severity === "error");
  const warnings = failure.issues.filter((i) => i.severity === "warning");
  const shown = errors.length > 0 ? errors : failure.issues;

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={styles.dialog}
      >
        <h2 id={titleId} className={styles.title}>
          {failure.title ?? "Download blocked"}
        </h2>
        <p className={styles.message}>{failure.message}</p>
        {failure.protocol || failure.radioId ? (
          <p className={styles.meta}>
            Validated as{" "}
            <strong>{failure.protocol ?? "unknown protocol"}</strong>
            {failure.radioId ? (
              <>
                {" "}
                on <strong>{failure.radioId}</strong>
              </>
            ) : null}
            .
          </p>
        ) : null}

        {shown.length > 0 ? (
          <ul className={styles.issueList}>
            {shown.slice(0, 12).map((issue) => (
              <li
                key={`${issue.severity}:${issue.line ?? "x"}:${issue.message}`}
                data-severity={issue.severity}
              >
                {issue.line != null ? (
                  <span className={styles.line}>L{issue.line}</span>
                ) : null}
                <span>{issue.message}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {warnings.length > 0 && errors.length > 0 ? (
          <p className={styles.meta}>
            Also {warnings.length} warning
            {warnings.length === 1 ? "" : "s"} (warnings alone do not block
            download).
          </p>
        ) : null}

        {failure.hint ? <p className={styles.hint}>{failure.hint}</p> : null}

        <div className={styles.actions}>
          <button
            ref={closeRef}
            type="button"
            className={styles.secondary}
            onClick={onClose}
          >
            Close
          </button>
          {onReview ? (
            <button
              type="button"
              className={styles.primary}
              onClick={() => {
                onReview();
                onClose();
              }}
            >
              Review issues
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
