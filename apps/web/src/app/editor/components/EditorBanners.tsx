"use client";

import { memo } from "react";
import { hasColorWasmSim } from "@widget-gen/shared";
import styles from "../editor.module.css";

export const EditorBanners = memo(function EditorBanners({
  loadError,
  onDismissError,
  skippedTextCount,
  unreliable,
  inlineSim,
  radioId,
  usesBitmap,
  hasModelPng,
}: {
  loadError: string | null;
  onDismissError: () => void;
  skippedTextCount: number;
  unreliable: boolean;
  inlineSim: boolean;
  radioId: string;
  usesBitmap: boolean;
  hasModelPng: boolean;
}) {
  const radioPreviewOn = inlineSim && hasColorWasmSim(radioId);

  return (
    <>
      {loadError ? (
        <div className={styles.bannerStack}>
          <div className={styles.errorBanner} role="alert">
            {loadError}
            <button
              type="button"
              className={styles.bannerDismiss}
              onClick={onDismissError}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}

      {skippedTextCount > 0 || unreliable ? (
        <div className={styles.bannerStack}>
          <div className={styles.warnBanner} role="status">
            <strong>
              {radioPreviewOn
                ? "Layout overlay may miss some draws"
                : "Approximate preview may differ from the radio"}
            </strong>
            <ul>
              {skippedTextCount > 0 ? (
                <li>
                  {skippedTextCount} text draw(s) could not be evaluated for
                  selection — they still appear in radio preview; edit those in
                  Source.
                </li>
              ) : null}
              {unreliable ? (
                <li>
                  Gauge/annulus layout could not be fully resolved in the
                  overlay — trust radio preview pixels.
                </li>
              ) : null}
              {!radioPreviewOn ? (
                <li>
                  Turn on View → Show radio preview (or Simulator) for EdgeTX
                  pixels.
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      ) : null}

      {usesBitmap && !hasModelPng && hasColorWasmSim(radioId) ? (
        <div className={styles.bannerStack}>
          <div className={styles.warnBanner} role="status">
            This widget draws a model bitmap — upload a PNG via View → Upload
            model PNG… so radio preview matches the radio SD image.
          </div>
        </div>
      ) : null}
    </>
  );
});
