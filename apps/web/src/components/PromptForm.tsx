"use client";

import { useState } from "react";
import type { TelemetryProtocol } from "@widget-gen/shared";
import { EDGE_TX_VERSION_OPTIONS, DEFAULT_EDGE_TX_VERSION } from "@/lib/edgeTxVersions";
import styles from "./PromptForm.module.css";

interface PromptFormProps {
  onGenerate: (prompt: string, radioId: string, protocol: TelemetryProtocol, edgeTxVersion: string) => void;
  onRefine: (prompt: string) => void;
  running: boolean;
  canRefine: boolean;
}

export function PromptForm({ onGenerate, onRefine, running, canRefine }: PromptFormProps) {
  const [prompt, setPrompt] = useState(
    "Clean full-screen TX15 dashboard: header bar, link quality card with progress bar, large battery voltage card, GPS strip (alt/speed/sats), flight mode footer — dark theme, card panels, Betaflight ELRS"
  );
  const [refinePrompt, setRefinePrompt] = useState("");
  const [protocol, setProtocol] = useState<TelemetryProtocol>("betaflight");
  const [edgeTxVersion, setEdgeTxVersion] = useState(DEFAULT_EDGE_TX_VERSION);

  return (
    <div className={styles.form}>
      <label className={styles.label}>
        Dashboard prompt
        <textarea
          className={styles.textarea}
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={running}
          placeholder="Describe your dashboard layout and telemetry..."
        />
      </label>

      <div className={styles.row}>
        <label className={styles.label}>
          Radio
          <select className={styles.select} disabled>
            <option>TX15 (480×320)</option>
          </select>
        </label>

        <label className={styles.label}>
          Protocol
          <select
            className={styles.select}
            value={protocol}
            onChange={(e) => setProtocol(e.target.value as TelemetryProtocol)}
            disabled={running}
          >
            <option value="betaflight">Betaflight (CRSF)</option>
            <option value="rotorflight">Rotorflight (CRSF)</option>
            <option value="generic-crsf">Generic CRSF</option>
          </select>
        </label>

        <label className={styles.label}>
          EdgeTX
          <select
            className={styles.select}
            value={edgeTxVersion}
            onChange={(e) => setEdgeTxVersion(e.target.value)}
            disabled={running}
          >
            {EDGE_TX_VERSION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        className={styles.primary}
        disabled={running || !prompt.trim()}
        onClick={() => onGenerate(prompt, "tx15", protocol, edgeTxVersion)}
      >
        {running ? "Generating…" : "Generate widget"}
      </button>

      {canRefine && (
        <div className={styles.refine}>
          <label className={styles.label}>
            Refine
            <input
              className={styles.input}
              value={refinePrompt}
              onChange={(e) => setRefinePrompt(e.target.value)}
              disabled={running}
              placeholder="e.g. Make the battery gauge larger"
            />
          </label>
          <button
            className={styles.secondary}
            disabled={running || !refinePrompt.trim()}
            onClick={() => {
              onRefine(refinePrompt);
              setRefinePrompt("");
            }}
          >
            Refine
          </button>
        </div>
      )}
    </div>
  );
}
