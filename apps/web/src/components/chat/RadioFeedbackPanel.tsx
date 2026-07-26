"use client";

import { useCallback, useRef, useState } from "react";
import {
  maxPromptImages,
  readPromptImageFile,
  type PendingPromptImage,
} from "~/lib/promptImages";
import styles from "./RadioFeedbackPanel.module.css";

interface RadioFeedbackPanelProps {
  disabled?: boolean;
  onSubmit: (prompt: string, images?: PendingPromptImage[]) => void;
}

/**
 * Closed loop after install: photo + notes of the radio screen → refine prompt.
 */
export function RadioFeedbackPanel({
  disabled = false,
  onSubmit,
}: RadioFeedbackPanelProps) {
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<PendingPromptImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPick = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const img = await readPromptImageFile(file);
      setPhoto(img);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read image");
    }
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = notes.trim();
    if (!trimmed && !photo) {
      setError("Add a photo of the radio screen and/or notes.");
      return;
    }
    const prompt = [
      "Radio feedback (on-radio screen after install):",
      trimmed || "(see attached photo)",
      "",
      "Please refine the dashboard to match this feedback. Keep catalog sensors and lcd.* draws in refresh().",
    ].join("\n");
    onSubmit(prompt, photo ? [photo] : undefined);
    setNotes("");
    setPhoto(null);
    setError(null);
  }, [notes, photo, onSubmit]);

  return (
    <section className={styles.root} aria-label="On-radio feedback">
      <h3 className={styles.title}>Radio feedback → refine</h3>
      <p className={styles.lead}>
        After install, attach a photo of the TX screen and notes. Sends a refine
        prompt with your image (up to {maxPromptImages()} total in chat).
      </p>
      <textarea
        className={styles.notes}
        rows={3}
        placeholder="e.g. Headspeed overlaps battery bar; make model panel taller…"
        value={notes}
        disabled={disabled}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className={styles.row}>
        <button
          type="button"
          className={styles.secondary}
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
        >
          {photo ? "Replace photo…" : "Attach radio photo…"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            void onPick(file);
          }}
        />
        {photo ? (
          <button
            type="button"
            className={styles.ghost}
            disabled={disabled}
            onClick={() => setPhoto(null)}
          >
            Clear photo
          </button>
        ) : null}
        <button
          type="button"
          className={styles.primary}
          disabled={disabled || (!notes.trim() && !photo)}
          onClick={handleSubmit}
        >
          Send to refine
        </button>
      </div>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.thumb} src={photo.previewUrl} alt={photo.name} />
      ) : null}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
