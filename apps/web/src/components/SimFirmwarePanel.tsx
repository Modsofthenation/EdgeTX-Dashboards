"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./SimFirmwarePanel.module.css";

type FirmwareFile = {
  name: string;
  present: boolean;
  size: number;
  ok: boolean;
  sizeLabel: string;
};

type FirmwareRadio = {
  id: string;
  name: string;
  flavour: string;
  wasm: string;
  display: { w: number; h: number; depth: number };
  present: boolean;
  size: number;
  ok: boolean;
  sizeLabel: string;
};

type FirmwareStatus = {
  ready: boolean;
  reason: string;
  defaultVersion: string | null;
  syncedAt: string | null;
  source: string | null;
  radios?: FirmwareRadio[];
  files: FirmwareFile[];
  error?: string;
  downloaded?: boolean;
};

function formatSyncedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SimFirmwarePanel() {
  const [status, setStatus] = useState<FirmwareStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRawFiles, setShowRawFiles] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sim-firmware", { cache: "no-store" });
      const body = (await res.json()) as FirmwareStatus & { error?: string };
      if (!res.ok) throw new Error(body.error ?? `Status ${res.status}`);
      setStatus(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const download = useCallback(async () => {
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch("/api/sim-firmware", { method: "POST" });
      const body = (await res.json()) as FirmwareStatus & { error?: string };
      if (!res.ok)
        throw new Error(body.error ?? `Download failed (${res.status})`);
      setStatus(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDownloading(false);
    }
  }, []);

  const radios = status?.radios ?? [];
  const readyRadios = radios.filter((r) => r.ok).length;
  const totalBytes =
    radios.length > 0
      ? radios.reduce((sum, radio) => sum + (radio.ok ? radio.size : 0), 0)
      : (status?.files.reduce(
          (sum, file) => sum + (file.ok ? file.size : 0),
          0,
        ) ?? 0);

  return (
    <section className={styles.panel}>
      <header className={styles.head}>
        <div className={styles.titleRow}>
          <h3 className={styles.title}>Simulator firmware (WASM)</h3>
          <span className={status?.ready ? styles.badgeOk : styles.badgeWarn}>
            {loading ? "Checking…" : status?.ready ? "Ready" : "Not installed"}
          </span>
        </div>
        <p className={styles.hint}>
          Color and B&W EdgeTX firmwares power radio preview and the interactive
          sim. Download once per machine; files land in <code>public/sim</code>.
        </p>
      </header>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <dl className={styles.meta}>
        <div>
          <dt>Default</dt>
          <dd>{status?.defaultVersion ?? "—"}</dd>
        </div>
        <div>
          <dt>Radios</dt>
          <dd>
            {radios.length > 0
              ? `${readyRadios}/${radios.length}`
              : status?.ready
                ? "ok"
                : "—"}
          </dd>
        </div>
        <div>
          <dt>On disk</dt>
          <dd>
            {totalBytes > 0
              ? `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`
              : "—"}
          </dd>
        </div>
        <div>
          <dt>Synced</dt>
          <dd
            title={
              status?.syncedAt
                ? new Date(status.syncedAt).toLocaleString()
                : undefined
            }
          >
            {status?.syncedAt ? formatSyncedAt(status.syncedAt) : "—"}
          </dd>
        </div>
      </dl>

      {radios.length > 0 ? (
        <ul className={styles.fileList} aria-label="WASM radios">
          {radios.map((radio) => (
            <li
              key={radio.id}
              className={radio.ok ? styles.fileOk : styles.fileMissing}
            >
              <span className={styles.radioMain}>
                <span className={styles.radioName}>{radio.name}</span>
                <span className={styles.radioMeta}>
                  {radio.display.w}×{radio.display.h} · {radio.flavour}
                </span>
              </span>
              <span className={styles.fileMeta}>
                {radio.ok ? radio.sizeLabel : "missing"}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <ul className={styles.fileList}>
          {(status?.files ?? []).map((file) => (
            <li
              key={file.name}
              className={file.ok ? styles.fileOk : styles.fileMissing}
            >
              <span className={styles.fileName}>{file.name}</span>
              <span className={styles.fileMeta}>
                {file.ok ? file.sizeLabel : "missing"}
              </span>
            </li>
          ))}
          {!loading && (status?.files.length ?? 0) === 0 ? (
            <li className={styles.fileMissing}>No firmware files found</li>
          ) : null}
        </ul>
      )}

      {radios.length > 0 ? (
        <div className={styles.rawToggle}>
          <button
            type="button"
            className={styles.linkBtn}
            onClick={() => setShowRawFiles((v) => !v)}
            aria-expanded={showRawFiles}
          >
            {showRawFiles ? "Hide raw files" : "Show raw files"}
          </button>
          {showRawFiles ? (
            <ul className={styles.fileList}>
              {(status?.files ?? []).map((file) => (
                <li
                  key={file.name}
                  className={file.ok ? styles.fileOk : styles.fileMissing}
                >
                  <span className={styles.fileName}>{file.name}</span>
                  <span className={styles.fileMeta}>
                    {file.ok ? file.sizeLabel : "missing"}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.secondaryBtn}
          onClick={() => void refresh()}
          disabled={loading || downloading}
        >
          Refresh
        </button>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={() => void download()}
          disabled={downloading}
        >
          {downloading
            ? "Downloading…"
            : status?.ready
              ? "Re-download firmware"
              : "Download WASM firmware"}
        </button>
      </div>
    </section>
  );
}
