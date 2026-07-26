"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./InstallWizard.module.css";

interface InstallWizardProps {
  widgetName?: string;
  luaSource?: string | null;
  installMd?: string | null;
  workspaceKey?: string | null;
  sessionId?: string | null;
}

type WizardStep = "checklist" | "copy" | "done";

async function isTauri(): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Boolean((window as any).__TAURI_INTERNALS__);
  } catch {
    return false;
  }
}

export function InstallWizard({
  widgetName,
  luaSource,
  installMd,
  workspaceKey,
  sessionId,
}: InstallWizardProps) {
  const [step, setStep] = useState<WizardStep>("checklist");
  const [desktop, setDesktop] = useState(false);
  const [sdPath, setSdPath] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checks, setChecks] = useState({
    unzip: false,
    widgets: false,
    model: false,
    rf2bg: false,
  });

  useEffect(() => {
    void isTauri().then(setDesktop);
  }, []);

  const pickSd = useCallback(async () => {
    setStatus(null);
    setBusy(true);
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select EdgeTX SD card root (contains WIDGETS/)",
      });
      if (typeof selected === "string") {
        setSdPath(selected);
        setStep("copy");
      }
    } catch (err) {
      setStatus(
        err instanceof Error
          ? err.message
          : "Folder picker unavailable — download the zip and copy manually.",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const copyToSd = useCallback(async () => {
    if (!sdPath) return;
    if (!luaSource || !widgetName) {
      setStatus("No widget Lua loaded to copy.");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke<{ dest: string }>("install_widget_to_sd", {
        sdRoot: sdPath,
        widgetName,
        luaSource,
        installMd: installMd ?? null,
      });
      setStatus(`Copied to ${result.dest}`);
      setStep("done");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [sdPath, luaSource, widgetName, installMd]);

  const downloadZip = useCallback(() => {
    const params = new URLSearchParams();
    if (workspaceKey) params.set("workspaceKey", workspaceKey);
    else if (sessionId) params.set("sessionId", sessionId);
    window.open(`/api/download?${params.toString()}`, "_blank");
  }, [workspaceKey, sessionId]);

  return (
    <section className={styles.root} aria-label="Install to SD card">
      <h2 className={styles.title}>Install wizard</h2>
      <p className={styles.lead}>
        Get {widgetName ? <strong>{widgetName}</strong> : "this dashboard"} onto
        your radio SD card.
      </p>

      <ol className={styles.checklist}>
        <li>
          <label>
            <input
              type="checkbox"
              checked={checks.unzip}
              onChange={(e) =>
                setChecks((c) => ({ ...c, unzip: e.target.checked }))
              }
            />
            Download / unzip the widget package
          </label>
        </li>
        <li>
          <label>
            <input
              type="checkbox"
              checked={checks.widgets}
              onChange={(e) =>
                setChecks((c) => ({ ...c, widgets: e.target.checked }))
              }
            />
            Copy into <code>WIDGETS/&lt;Name&gt;/</code> on the SD card
          </label>
        </li>
        <li>
          <label>
            <input
              type="checkbox"
              checked={checks.model}
              onChange={(e) =>
                setChecks((c) => ({ ...c, model: e.target.checked }))
              }
            />
            On the radio: Model setup → Widgets → add the dashboard full-screen
          </label>
        </li>
        <li>
          <label>
            <input
              type="checkbox"
              checked={checks.rf2bg}
              onChange={(e) =>
                setChecks((c) => ({ ...c, rf2bg: e.target.checked }))
              }
            />
            Rotorflight: Special Function → rf2bg (Repeat On), then Discover new
          </label>
        </li>
      </ol>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.secondary}
          onClick={downloadZip}
        >
          Download zip
        </button>
        {desktop ? (
          <button
            type="button"
            className={styles.primary}
            disabled={busy}
            onClick={() => void pickSd()}
          >
            {sdPath ? "Change SD folder…" : "Pick SD card folder…"}
          </button>
        ) : (
          <p className={styles.hint}>
            SD folder copy is available in the desktop app.
          </p>
        )}
        {desktop && sdPath && step !== "done" ? (
          <button
            type="button"
            className={styles.primary}
            disabled={busy || !luaSource}
            onClick={() => void copyToSd()}
          >
            Copy WIDGETS to SD
          </button>
        ) : null}
      </div>

      {sdPath ? (
        <p className={styles.path}>
          SD root: <code>{sdPath}</code>
        </p>
      ) : null}
      {status ? <p className={styles.status}>{status}</p> : null}
      {step === "done" ? (
        <p className={styles.done}>
          Installed. Eject the SD card safely, then add the widget on the radio.
        </p>
      ) : null}
    </section>
  );
}
