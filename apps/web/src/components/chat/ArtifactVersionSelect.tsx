"use client";

import type { WidgetVersionEntry } from "@/lib/chatTypes";
import { formatVersionOptionLabel } from "@/lib/chatTypes";
import styles from "./ArtifactVersionSelect.module.css";

interface ArtifactVersionSelectProps {
  versions: WidgetVersionEntry[];
  latestVersion: number;
  selectedVersion: number;
  onSelectVersion: (version: number) => void;
  disabled?: boolean;
}

export function ArtifactVersionSelect({
  versions,
  latestVersion,
  selectedVersion,
  onSelectVersion,
  disabled = false,
}: ArtifactVersionSelectProps) {
  if (versions.length <= 1) return null;

  const isViewingLatest = selectedVersion === latestVersion;

  return (
    <div className={styles.wrap}>
      <label className={styles.label} htmlFor="artifact-version-select">
        Version
      </label>
      <div className={styles.row}>
        <select
          id="artifact-version-select"
          className={styles.select}
          value={selectedVersion}
          disabled={disabled}
          onChange={(e) => onSelectVersion(Number.parseInt(e.target.value, 10))}
        >
          {[...versions]
            .sort((a, b) => b.version - a.version)
            .map((entry) => (
              <option key={entry.version} value={entry.version}>
                {formatVersionOptionLabel(entry.version, latestVersion)}
                {entry.validated ? " ✓" : ""}
              </option>
            ))}
        </select>
        {!isViewingLatest && (
          <button
            type="button"
            className={styles.latestBtn}
            disabled={disabled}
            onClick={() => onSelectVersion(latestVersion)}
          >
            Latest
          </button>
        )}
      </div>
      {!isViewingLatest && (
        <p className={styles.hint}>Viewing an earlier snapshot — refine always updates the latest version.</p>
      )}
    </div>
  );
}
