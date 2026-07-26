"use client";

import { useEffect, useId, useState } from "react";
import { useAiSettings } from "~/components/AiSettingsProvider";
import { openAppPreferences } from "~/components/AppPreferences";
import styles from "./FirstRunWizard.module.css";

const DISMISS_KEY = "edgetx.firstRunWizard.dismissed.v1";

/**
 * One-time desktop/browser gate: nudge pilots to set a Cursor API key
 * before generate fails with a cryptic error.
 */
export function FirstRunWizard() {
  const { ready, hydrated, statusLoading } = useAiSettings();
  const titleId = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!hydrated || statusLoading) return;
    if (ready) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* ignore */
    }
    setOpen(true);
  }, [hydrated, statusLoading, ready]);

  if (!open) return null;

  const dismiss = (remember: boolean) => {
    if (remember) {
      try {
        localStorage.setItem(DISMISS_KEY, "1");
      } catch {
        /* ignore */
      }
    }
    setOpen(false);
  };

  return (
    <div className={styles.backdrop} role="presentation">
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className={styles.title}>
          Set up AI generation
        </h2>
        <p className={styles.lead}>
          Add an AI API key (Cursor, Anthropic, or OpenAI) to generate Lua from
          chat, or skip AI and build visually in Layout (Insert / prefabs). You
          can also set <code>CURSOR_API_KEY</code>,{" "}
          <code>ANTHROPIC_API_KEY</code>, or <code>OPENAI_API_KEY</code> on the
          server for shared installs.
        </p>
        <ol className={styles.steps}>
          <li>Open Preferences → AI (optional for generate)</li>
          <li>Choose a provider, paste your API key, and Save — or open Layout</li>
          <li>Describe a dashboard, or place elements by hand</li>
        </ol>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => dismiss(true)}
          >
            Skip for now
          </button>
          <a
            href="/editor"
            className={styles.secondary}
            onClick={() => dismiss(true)}
          >
            Open Layout
          </a>
          <button
            type="button"
            className={styles.primary}
            onClick={() => {
              dismiss(true);
              openAppPreferences("ai");
            }}
          >
            Open AI preferences
          </button>
        </div>
      </div>
    </div>
  );
}
