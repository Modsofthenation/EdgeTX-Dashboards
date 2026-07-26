"use client";

import { useCallback, useEffect, useState } from "react";
import { saveBlobToDisk } from "~/lib/desktopDownload";
import styles from "./InstallWizard.module.css";

type SdFile = { path: string; content: string; encoding?: string };

interface InstallWizardProps {
  widgetName?: string;
  luaSource?: string | null;
  installMd?: string | null;
  workspaceKey?: string | null;
  sessionId?: string | null;
  /** Telemetry protocol required by /api/download when no sessionId. */
  protocol?: string;
  /** Extra SD files (companions / IMAGES) merged when package API is empty. */
  extraFiles?: SdFile[];
  /** Companion suite labels included in the package (shown in checklist). */
  companionLabels?: string[];
  /** True when a model PNG / bitmap is part of the package. */
  hasModelImage?: boolean;
  radioName?: string;
  lcdW?: number;
  lcdH?: number;
  touch?: boolean;
}

type WizardStep = "checklist" | "copy" | "done";

const EMPTY_COMPANION_LABELS: string[] = [];

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
  protocol = "betaflight",
  extraFiles,
  companionLabels = EMPTY_COMPANION_LABELS,
  hasModelImage = false,
  radioName = "your radio",
  lcdW = 480,
  lcdH = 320,
  touch = true,
}: InstallWizardProps) {
  const [step, setStep] = useState<WizardStep>("checklist");
  const [desktop, setDesktop] = useState(false);
  const [sdPath, setSdPath] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checks, setChecks] = useState({
    unzip: false,
    widgets: false,
    companions: false,
    modelBitmap: false,
    model: false,
    rf2bg: false,
    verifyTele: false,
    verifyFullscreen: false,
    verifySensors: false,
  });

  const isRotorflight = protocol === "rotorflight";

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

  const fetchPackageFiles = useCallback(async (): Promise<SdFile[]> => {
    const params = new URLSearchParams();
    if (workspaceKey) params.set("workspaceKey", workspaceKey);
    else if (sessionId) params.set("sessionId", sessionId);
    else return [];
    const res = await fetch(`/api/widget-package-files?${params}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { files?: SdFile[] };
    return Array.isArray(data.files) ? data.files : [];
  }, [workspaceKey, sessionId]);

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
      let files = await fetchPackageFiles();
      if (files.length === 0) {
        files = [
          {
            path: `WIDGETS/${widgetName}/main.lua`,
            content: luaSource,
            encoding: "utf8",
          },
        ];
        if (installMd?.trim()) {
          files.push({
            path: `WIDGETS/${widgetName}/INSTALL.md`,
            content: installMd,
            encoding: "utf8",
          });
        }
        if (extraFiles?.length) {
          files = [...files, ...extraFiles];
        }
      } else if (extraFiles?.length) {
        const existing = new Set(files.map((f) => f.path));
        for (const extra of extraFiles) {
          if (!existing.has(extra.path)) files.push(extra);
        }
      }
      const result = await invoke<{ dest: string; files?: string[] }>(
        "install_widget_to_sd",
        {
          sdRoot: sdPath,
          widgetName,
          luaSource,
          installMd: installMd ?? null,
          files,
        },
      );
      const n = result.files?.length ?? files.length;
      setStatus(
        n > 1
          ? `Copied ${n} files (widget + companions) to ${result.dest}`
          : `Copied to ${result.dest}`,
      );
      setStep("done");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [sdPath, luaSource, widgetName, installMd, fetchPackageFiles, extraFiles]);

  const downloadZip = useCallback(async () => {
    setBusy(true);
    setStatus(null);
    try {
      const params = new URLSearchParams({ protocol });
      if (sessionId) params.set("sessionId", sessionId);
      else if (workspaceKey) params.set("instanceId", workspaceKey);
      else if (widgetName) params.set("name", widgetName);
      else {
        setStatus("Save the widget before downloading");
        return;
      }

      const res = await fetch(`/api/download?${params}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setStatus(body.error ?? `Download failed (${res.status})`);
        return;
      }

      const blob = await res.blob();
      const fileName = `${(widgetName || "widget").replace(/[^\w.-]+/g, "_")}.zip`;
      const saved = await saveBlobToDisk(blob, fileName, {
        title: "Save widget zip",
        filters: [{ name: "Zip archive", extensions: ["zip"] }],
      });
      if (!saved.ok && "error" in saved) {
        setStatus(saved.error);
        return;
      }
      if (saved.ok) {
        setChecks((c) => ({ ...c, unzip: true }));
        setStatus(saved.path ? `Saved zip to ${saved.path}` : "Zip downloaded");
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [protocol, sessionId, workspaceKey, widgetName]);

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
            Copy into <code>WIDGETS/&lt;Name&gt;/</code> (plus{" "}
            <code>SCRIPTS/</code> companions when present)
          </label>
        </li>
        {companionLabels.length > 0 ? (
          <li>
            <label>
              <input
                type="checkbox"
                checked={checks.companions}
                onChange={(e) =>
                  setChecks((c) => ({ ...c, companions: e.target.checked }))
                }
              />
              Confirm companion scripts are present under <code>SCRIPTS/</code>
            </label>
          </li>
        ) : null}
        {hasModelImage ? (
          <li>
            <label>
              <input
                type="checkbox"
                checked={checks.modelBitmap}
                onChange={(e) =>
                  setChecks((c) => ({ ...c, modelBitmap: e.target.checked }))
                }
              />
              Assign model bitmap on SD (<code>IMAGES/</code> /{" "}
              <code>drawBitmap</code> path)
            </label>
          </li>
        ) : null}
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
        {isRotorflight ? (
          <li>
            <label>
              <input
                type="checkbox"
                checked={checks.rf2bg}
                onChange={(e) =>
                  setChecks((c) => ({ ...c, rf2bg: e.target.checked }))
                }
              />
              Rotorflight: Special Function → rf2bg (Repeat On), then Discover
              new
            </label>
          </li>
        ) : null}
      </ol>

      <h3 className={styles.verifyTitle}>Verify on radio ({radioName})</h3>
      <ol className={styles.checklist}>
        <li>
          <label>
            <input
              type="checkbox"
              checked={checks.verifyTele}
              onChange={(e) =>
                setChecks((c) => ({ ...c, verifyTele: e.target.checked }))
              }
            />
            {touch
              ? `Press TELE (or tap Telemetry) → confirm sensors populate on ${radioName}`
              : `Press TELE → scroll Telemetry page → confirm sensors populate on ${radioName}`}
          </label>
        </li>
        <li>
          <label>
            <input
              type="checkbox"
              checked={checks.verifyFullscreen}
              onChange={(e) =>
                setChecks((c) => ({
                  ...c,
                  verifyFullscreen: e.target.checked,
                }))
              }
            />
            {touch
              ? `Long-press widget zone → Full screen (or double-tap). Dashboard fills ${lcdW}×${lcdH}`
              : `Long-press widget zone → Full screen. Dashboard fills ${lcdW}×${lcdH} (no touch)`}
          </label>
        </li>
        <li>
          <label>
            <input
              type="checkbox"
              checked={checks.verifySensors}
              onChange={(e) =>
                setChecks((c) => ({ ...c, verifySensors: e.target.checked }))
              }
            />
            {isRotorflight
              ? "Values update live (battery/link; run sensor_dump tool after Discover new if using HSpd/Gov/Vbec)"
              : "Values update live (battery/link/attitude)"}
          </label>
        </li>
      </ol>

      {companionLabels.length > 0 ? (
        <div className={styles.companionStatus}>
          <p className={styles.companionStatusTitle}>Companion suites</p>
          <ul className={styles.companionList}>
            {companionLabels.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {isRotorflight ? (
        <div className={styles.companionStatus}>
          <p className={styles.companionStatusTitle}>Rotorflight companions</p>
          <p className={styles.rfNote}>
            Include the <strong>sensor_dump</strong> tool companion, enable
            rf2bg (Repeat On), then Discover new — HSpd/Gov/Vbec are not
            standard CRSF wire sensors.
          </p>
        </div>
      ) : null}

      <div className={styles.actions}>
        {desktop ? (
          <>
            {!sdPath ? (
              <button
                type="button"
                className={styles.primary}
                disabled={busy}
                onClick={() => void pickSd()}
              >
                Pick SD card folder…
              </button>
            ) : (
              <button
                type="button"
                className={styles.primary}
                disabled={busy || !luaSource || step === "done"}
                onClick={() => void copyToSd()}
              >
                {busy ? "Copying…" : "Copy to SD card"}
              </button>
            )}
            {sdPath && step !== "done" ? (
              <button
                type="button"
                className={styles.secondary}
                disabled={busy}
                onClick={() => void pickSd()}
              >
                Change SD folder…
              </button>
            ) : null}
            <button
              type="button"
              className={styles.secondary}
              disabled={busy}
              onClick={() => void downloadZip()}
            >
              {busy ? "Downloading…" : "Download zip"}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={styles.primary}
              disabled={busy}
              onClick={() => void downloadZip()}
            >
              {busy ? "Downloading…" : "Download zip"}
            </button>
            <p className={styles.hint}>
              SD folder copy is available in the desktop app.
            </p>
          </>
        )}
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
