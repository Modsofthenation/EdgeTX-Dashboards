"use client";

import { useEffect, useId, useState } from "react";
import { AI_PROVIDERS, formatList } from "@widget-gen/shared";
import { useAiSettings } from "~/components/AiSettingsProvider";
import { openAppPreferences } from "~/components/AppPreferences";
import styles from "./FirstRunWizard.module.css";

const DISMISS_KEY = "edgetx.firstRunWizard.dismissed.v1";

/**
 * One-time desktop/browser gate: nudge pilots to set an AI API key
 * before generate fails with a cryptic error.
 */
export function FirstRunWizard() {
  const { ready, hydrated, statusLoading } = useAiSettings();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const providerLabels = formatList(
    AI_PROVIDERS.map((p) => p.label),
    "or",
  );
  const providerEnvVars = AI_PROVIDERS.map((p) => p.envVar);
  const envVarSep = (i: number) => {
    if (i === 0) return null;
    if (i === providerEnvVars.length - 1) {
      return providerEnvVars.length === 2 ? " or " : ", or ";
    }
    return ", ";
  };

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
          Add an AI API key ({providerLabels}) to generate Lua from chat, or
          skip AI and build visually in Layout (Insert / prefabs). You can also
          set{" "}
          {providerEnvVars.map((env, i) => (
            <span key={env}>
              {envVarSep(i)}
              <code>{env}</code>
            </span>
          ))}{" "}
          on the server for shared installs.
        </p>
        <ol className={styles.steps}>
          <li>Open Preferences → AI (optional for generate)</li>
          <li>
            Choose a provider, paste your API key, and Save — or open Layout
          </li>
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
