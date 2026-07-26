"use client";

import { useEffect, useId, useRef } from "react";
import { InstallWizard } from "~/components/InstallWizard";
import styles from "../editor.module.css";

export type ExportInstallFile = {
  path: string;
  content: string;
  encoding?: string;
};

interface ExportInstallModalProps {
  open: boolean;
  onClose: () => void;
  widgetName?: string;
  luaSource?: string | null;
  installMd?: string | null;
  workspaceKey?: string | null;
  sessionId?: string | null;
  protocol?: string;
  radioId?: string | null;
  extraFiles?: ExportInstallFile[];
  companionLabels?: string[];
  hasModelImage?: boolean;
  radioName?: string;
  lcdW?: number;
  lcdH?: number;
  touch?: boolean;
  validationErrorCount?: number;
  onBeforeDownload?: () => Promise<string | null | undefined>;
  onReviewValidation?: () => void;
}

export function ExportInstallModal({
  open,
  onClose,
  widgetName,
  luaSource,
  installMd,
  workspaceKey,
  sessionId,
  protocol,
  radioId,
  extraFiles,
  companionLabels,
  hasModelImage,
  radioName,
  lcdW,
  lcdH,
  touch,
  validationErrorCount = 0,
  onBeforeDownload,
  onReviewValidation,
}: ExportInstallModalProps) {
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

  if (!open) return null;

  return (
    <div
      className={styles.modalBackdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`${styles.modal} ${styles.exportModal}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHead}>
          <h2 id={titleId} className={styles.modalTitle}>
            Export to radio
          </h2>
          <button
            ref={closeRef}
            type="button"
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <p className={styles.modalHint}>
          Package{" "}
          {widgetName ? <strong>{widgetName}</strong> : "this dashboard"} for
          your SD card — download a zip, or copy straight to the card in the
          desktop app.
        </p>

        {validationErrorCount > 0 ? (
          <div className={styles.exportValidationBanner} role="status">
            <p>
              {validationErrorCount} validation error
              {validationErrorCount === 1 ? "" : "s"} must be fixed before
              download.
            </p>
            {onReviewValidation ? (
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => {
                  onReviewValidation();
                  onClose();
                }}
              >
                Review issues
              </button>
            ) : null}
          </div>
        ) : null}

        <div className={styles.exportModalBody}>
          <InstallWizard
            embedded
            widgetName={widgetName}
            luaSource={luaSource}
            installMd={installMd}
            workspaceKey={workspaceKey}
            sessionId={sessionId}
            protocol={protocol}
            radioId={radioId}
            extraFiles={extraFiles}
            companionLabels={companionLabels}
            hasModelImage={hasModelImage}
            radioName={radioName}
            lcdW={lcdW}
            lcdH={lcdH}
            touch={touch}
            onBeforeDownload={onBeforeDownload}
            onReviewValidation={
              onReviewValidation
                ? () => {
                    onReviewValidation();
                    onClose();
                  }
                : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}
