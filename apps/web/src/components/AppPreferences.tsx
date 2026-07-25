"use client";

import { useEffect, useId, useState } from "react";
import { SimFirmwarePanel } from "~/components/SimFirmwarePanel";
import { useTheme } from "~/lib/theme/ThemeProvider";
import { THEME_OPTIONS, type ThemeId } from "~/lib/theme/themes";
import styles from "./AppPreferences.module.css";

type Tab = "appearance" | "simulator";

export function AppPreferencesButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        Preferences
      </button>
      {open ? <AppPreferencesModal onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function AppPreferencesModal({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const [tab, setTab] = useState<Tab>("appearance");
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.head}>
          <h2 id={titleId} className={styles.title}>
            Preferences
          </h2>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className={styles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "appearance"}
            className={tab === "appearance" ? styles.tabActive : styles.tab}
            onClick={() => setTab("appearance")}
          >
            Appearance
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "simulator"}
            className={tab === "simulator" ? styles.tabActive : styles.tab}
            onClick={() => setTab("simulator")}
          >
            Simulator WASM
          </button>
        </div>

        <div className={styles.body}>
          {tab === "appearance" ? (
            <section className={styles.themeSection}>
              <p className={styles.sectionHint}>
                Themes apply across Generate and Layout. The radio LCD canvas
                stays dark in every theme.
              </p>
              <div className={styles.themeGrid}>
                {THEME_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={
                      theme === option.id
                        ? styles.themeCardActive
                        : styles.themeCard
                    }
                    onClick={() => setTheme(option.id as ThemeId)}
                  >
                    <span
                      className={styles.swatch}
                      data-theme-preview={option.id}
                      aria-hidden
                    />
                    <span className={styles.themeLabel}>{option.label}</span>
                    <span className={styles.themeDesc}>
                      {option.description}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <SimFirmwarePanel />
          )}
        </div>
      </div>
    </div>
  );
}
