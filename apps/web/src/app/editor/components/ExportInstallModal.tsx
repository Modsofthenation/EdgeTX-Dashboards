"use client";

import { InstallWizard } from "~/components/InstallWizard";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
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
  /** Soft nudge when the user has not opened radio WASM this session. */
  needsSimVerifyNudge?: boolean;
  onVerifyInSim?: () => void;
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
  needsSimVerifyNudge = false,
  onVerifyInSim,
}: ExportInstallModalProps) {
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="w-full gap-3 overflow-y-auto sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle>Export to radio</SheetTitle>
          <SheetDescription>
            Package{" "}
            {widgetName ? <strong>{widgetName}</strong> : "this dashboard"} for
            your SD card — download a zip, or copy straight to the card in the
            desktop app.
          </SheetDescription>
        </SheetHeader>

        {needsSimVerifyNudge ? (
          <div className={styles.exportValidationBanner} role="status">
            <p>
              You have not checked radio preview this session. Approximate
              layout pixels can differ from EdgeTX — verify before flying.
            </p>
            {onVerifyInSim ? (
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => {
                  onVerifyInSim();
                  onClose();
                }}
              >
                Open simulator
              </button>
            ) : null}
          </div>
        ) : null}

        {validationErrorCount > 0 ? (
          <div className={styles.exportValidationBanner} role="status">
            <p>
              {validationErrorCount} validation error
              {validationErrorCount === 1 ? "" : "s"} must be fixed before
              export.
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
            validationErrorCount={validationErrorCount}
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
      </SheetContent>
    </Sheet>
  );
}
