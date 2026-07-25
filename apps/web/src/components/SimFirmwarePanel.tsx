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

type FirmwareStatus = {
  ready: boolean;
  reason: string;
  defaultVersion: string | null;
  syncedAt: string | null;
  source: string | null;
  files: FirmwareFile[];
  error?: string;
  downloaded?: boolean;
};

export function SimFirmwarePanel() {
  const [status, setStatus] = useState<FirmwareStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const totalBytes =
    status?.files.reduce((sum, file) => sum + (file.ok ? file.size : 0), 0) ??
    0;

  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        <div>
          <h3 className={styles.title}>Simulator firmware (WASM)</h3>
          <p className={styles.hint}>
            EdgeTX TX15 WASM (~5 MB) powers the radio preview and interactive
            sim. Download once per machine; files land in{" "}
            <code>public/sim</code>.
          </p>
        </div>
        <span className={status?.ready ? styles.badgeOk : styles.badgeWarn}>
          {loading ? "Checking…" : status?.ready ? "Ready" : "Not installed"}
        </span>
      </div>

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
          <dt>On disk</dt>
          <dd>
            {totalBytes > 0
              ? `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`
              : "—"}
          </dd>
        </div>
        <div>
          <dt>Synced</dt>
          <dd>
            {status?.syncedAt
              ? new Date(status.syncedAt).toLocaleString()
              : "—"}
          </dd>
        </div>
      </dl>

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
