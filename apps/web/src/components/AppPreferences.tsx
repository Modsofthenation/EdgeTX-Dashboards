"use client";

import { useEffect, useId, useState } from "react";
import { AiSettingsPanel } from "~/components/AiSettingsPanel";
import { useAiSettings } from "~/components/AiSettingsProvider";
import { SimFirmwarePanel } from "~/components/SimFirmwarePanel";
import { useTheme } from "~/lib/theme/ThemeProvider";
import { THEME_OPTIONS, type ThemeId } from "~/lib/theme/themes";
import styles from "./AppPreferences.module.css";

export type PreferencesTab = "appearance" | "ai" | "simulator";

export const OPEN_PREFERENCES_EVENT = "widget-gen:open-preferences";

export type OpenPreferencesDetail = {
  tab?: PreferencesTab;
};

export function openAppPreferences(tab: PreferencesTab = "appearance"): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<OpenPreferencesDetail>(OPEN_PREFERENCES_EVENT, {
      detail: { tab },
    }),
  );
}

export function AppPreferencesButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<PreferencesTab>("appearance");

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<OpenPreferencesDetail>).detail;
      setInitialTab(detail?.tab ?? "appearance");
      setOpen(true);
    };
    window.addEventListener(OPEN_PREFERENCES_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_PREFERENCES_EVENT, onOpen);
  }, []);

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          setInitialTab("appearance");
          setOpen(true);
        }}
        aria-haspopup="dialog"
      >
        Preferences
      </button>
      {open ? (
        <AppPreferencesModal
          initialTab={initialTab}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function AppPreferencesModal({
  onClose,
  initialTab = "appearance",
}: {
  onClose: () => void;
  initialTab?: PreferencesTab;
}) {
  const titleId = useId();
  const [tab, setTab] = useState<PreferencesTab>(initialTab);
  const { theme, setTheme, hydrated: themeHydrated } = useTheme();
  const { hydrated: aiHydrated } = useAiSettings();
  const prefsReady = themeHydrated && aiHydrated;

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

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
            aria-selected={tab === "ai"}
            className={tab === "ai" ? styles.tabActive : styles.tab}
            onClick={() => setTab("ai")}
          >
            AI
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
          {!prefsReady ? (
            <div className={styles.loading} role="status" aria-live="polite">
              <span className={styles.loadingSpinner} aria-hidden />
              <p className={styles.loadingText}>Loading preferences…</p>
            </div>
          ) : (
            <>
              {tab === "appearance" ? (
                <section className={styles.themeSection}>
                  <p className={styles.sectionHint}>
                    Themes apply across Generate and Layout. The radio LCD
                    canvas stays dark in every theme.
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
                        <span className={styles.themeLabel}>
                          {option.label}
                        </span>
                        <span className={styles.themeDesc}>
                          {option.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}
              {tab === "ai" ? <AiSettingsPanel /> : null}
              {tab === "simulator" ? <SimFirmwarePanel /> : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
