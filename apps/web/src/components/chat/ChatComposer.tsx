"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import type { TelemetryProtocol } from "@widget-gen/shared";
import { CHAT_MODELS } from "@/lib/chatModels";
import styles from "./ChatComposer.module.css";

interface ChatComposerProps {
  running: boolean;
  canRefine: boolean;
  protocol: TelemetryProtocol;
  modelId: string;
  edgeTxVersion: string;
  onProtocolChange: (protocol: TelemetryProtocol) => void;
  onModelChange: (modelId: string) => void;
  onEdgeTxChange: (version: string) => void;
  onSend: (prompt: string) => void;
}

export function ChatComposer({
  running,
  canRefine,
  protocol,
  modelId,
  edgeTxVersion,
  onProtocolChange,
  onModelChange,
  onEdgeTxChange,
  onSend,
}: ChatComposerProps) {
  const [input, setInput] = useState("");

  const submit = () => {
    const trimmed = input.trim();
    if (!trimmed || running) return;
    onSend(trimmed);
    setInput("");
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form className={styles.composer} onSubmit={handleSubmit}>
      <div className={styles.toolbar}>
        <label className={styles.selectWrap}>
          <span className={styles.selectLabel}>Model</span>
          <select
            className={styles.select}
            value={modelId}
            onChange={(e) => onModelChange(e.target.value)}
            disabled={running || canRefine}
            title={canRefine ? "Model is locked for this chat session" : undefined}
          >
            {CHAT_MODELS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.selectWrap}>
          <span className={styles.selectLabel}>Protocol</span>
          <select
            className={styles.select}
            value={protocol}
            onChange={(e) => onProtocolChange(e.target.value as TelemetryProtocol)}
            disabled={running || canRefine}
          >
            <option value="betaflight">Betaflight</option>
            <option value="rotorflight">Rotorflight</option>
            <option value="generic-crsf">Generic CRSF</option>
          </select>
        </label>

        <label className={styles.selectWrap}>
          <span className={styles.selectLabel}>EdgeTX</span>
          <select
            className={styles.select}
            value={edgeTxVersion}
            onChange={(e) => onEdgeTxChange(e.target.value)}
            disabled={running || canRefine}
          >
            <option value="2.11.0">2.11+</option>
            <option value="2.10.0">2.10</option>
          </select>
        </label>

        <span className={styles.metaChip}>TX15 · 480×320</span>
      </div>

      <div className={styles.inputRow}>
        <textarea
          className={styles.input}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={running}
          placeholder={
            canRefine
              ? "Refine the widget — e.g. make the battery card larger"
              : "Describe your EdgeTX dashboard widget…"
          }
        />
        <button type="submit" className={styles.sendBtn} disabled={running || !input.trim()}>
          {running ? "…" : "↑"}
        </button>
      </div>

      <p className={styles.hint}>Enter to send · Shift+Enter for new line</p>
    </form>
  );
}
