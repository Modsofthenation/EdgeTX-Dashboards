"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import type { TelemetryProtocol } from "@widget-gen/shared";
import type { ChatModel } from "@/lib/chatModels";
import {
  groupRadiosByLayout,
  LAYOUT_GROUP_LABELS,
  type RadioCatalogEntry,
} from "@/lib/radioCatalog";
import { PROTOCOL_BADGE_LABELS } from "@/lib/protocolLabels";
import styles from "./ChatComposer.module.css";

interface ChatComposerProps {
  running: boolean;
  canRefine: boolean;
  protocol: TelemetryProtocol;
  modelId: string;
  models: ChatModel[];
  modelsLoading?: boolean;
  edgeTxVersion: string;
  radioId: string;
  radios: RadioCatalogEntry[];
  onProtocolChange: (protocol: TelemetryProtocol) => void;
  onModelChange: (modelId: string) => void;
  onEdgeTxChange: (version: string) => void;
  onRadioChange: (radioId: string) => void;
  onSend: (prompt: string) => void;
}

export function ChatComposer({
  running,
  canRefine,
  protocol,
  modelId,
  models,
  modelsLoading,
  edgeTxVersion,
  radioId,
  radios,
  onProtocolChange,
  onModelChange,
  onEdgeTxChange,
  onRadioChange,
  onSend,
}: ChatComposerProps) {
  const [input, setInput] = useState("");

  const selectedRadio = radios.find((r) => r.id === radioId);
  const radioGroups = groupRadiosByLayout(radios);

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

  const settingsLocked = running || canRefine;

  const modelOptions =
    !modelsLoading && modelId && !models.some((m) => m.id === modelId)
      ? [{ id: modelId, label: modelId }, ...models]
      : models;

  return (
    <form className={styles.composer} onSubmit={handleSubmit}>
      <div className={styles.toolbar}>
        <label className={styles.selectWrap}>
          <span className={styles.selectLabel}>Radio</span>
          <select
            className={styles.select}
            value={radioId}
            onChange={(e) => onRadioChange(e.target.value)}
            disabled={settingsLocked}
            title={settingsLocked ? "Radio is locked for this chat session" : undefined}
          >
            {[...radioGroups.entries()].map(([layoutKey, group]) => (
              <optgroup key={layoutKey} label={LAYOUT_GROUP_LABELS[layoutKey] ?? layoutKey}>
                {group.map((radio) => (
                  <option key={radio.id} value={radio.id}>
                    {radio.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label className={styles.selectWrap}>
          <span className={styles.selectLabel}>Model</span>
          <select
            className={styles.select}
            value={modelId}
            onChange={(e) => onModelChange(e.target.value)}
            disabled={settingsLocked || modelsLoading || models.length === 0}
            title={settingsLocked ? "Model is locked for this chat session" : undefined}
          >
            {modelsLoading && <option value={modelId}>Loading models…</option>}
            {!modelsLoading &&
              modelOptions.map((model) => (
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
            disabled={settingsLocked}
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
            disabled={settingsLocked}
          >
            <option value="2.11.0">2.11+</option>
            <option value="2.10.0">2.10</option>
          </select>
        </label>

        {selectedRadio && (
          <span className={styles.metaChip}>
            {selectedRadio.lcdW}×{selectedRadio.lcdH}
            {selectedRadio.touch ? " · touch" : ""}
          </span>
        )}

        <span className={styles.protocolChip} title={settingsLocked ? "Protocol is locked for this chat session" : undefined}>
          {PROTOCOL_BADGE_LABELS[protocol]}
          {settingsLocked ? " · locked" : ""}
        </span>
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
              ? "Refine the dashboard — e.g. switch to a strip layout or add a flight logger tool"
              : "Describe your EdgeTX dashboard — layout, metrics, optional tools (battery selector, logger)…"
          }
        />
        <button type="submit" className={styles.sendBtn} disabled={running || !input.trim()}>
          {running ? <span className={styles.sendSpinner} aria-hidden /> : "↑"}
        </button>
      </div>

      <p className={styles.hint}>Enter to send · Shift+Enter for new line</p>
    </form>
  );
}
