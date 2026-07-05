"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { TelemetryProtocol } from "@widget-gen/shared";
import type { ChatModel } from "@/lib/chatModels";
import {
  groupRadiosByLayout,
  LAYOUT_GROUP_LABELS,
  type RadioCatalogEntry,
} from "@/lib/radioCatalog";
import { PROTOCOL_BADGE_LABELS } from "@/lib/protocolLabels";
import {
  maxPromptImages,
  readPromptImageFile,
  type PendingPromptImage,
} from "@/lib/promptImages";
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
  onSend: (prompt: string, images?: PendingPromptImage[]) => void;
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
  const [attachments, setAttachments] = useState<PendingPromptImage[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedRadio = radios.find((r) => r.id === radioId);
  const radioGroups = groupRadiosByLayout(radios);
  const canSend = !running && (input.trim().length > 0 || attachments.length > 0);

  const submit = () => {
    if (!canSend) return;
    onSend(input.trim(), attachments.length > 0 ? attachments : undefined);
    setInput("");
    setAttachments([]);
    setAttachError(null);
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

  const handlePickImages = async (files: FileList | null) => {
    if (!files?.length) return;
    setAttachError(null);

    const remaining = maxPromptImages() - attachments.length;
    if (remaining <= 0) {
      setAttachError(`At most ${maxPromptImages()} reference images`);
      return;
    }

    const picked = Array.from(files).slice(0, remaining);
    try {
      const next = await Promise.all(picked.map((file) => readPromptImageFile(file)));
      setAttachments((prev) => [...prev, ...next]);
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : "Could not read image");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((img) => img.id !== id));
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

      {attachments.length > 0 && (
        <div className={styles.attachments} aria-label="Reference images">
          {attachments.map((img) => (
            <div key={img.id} className={styles.attachment}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.previewUrl} alt={img.name} className={styles.attachmentThumb} />
              <button
                type="button"
                className={styles.attachmentRemove}
                onClick={() => removeAttachment(img.id)}
                disabled={running}
                aria-label={`Remove ${img.name}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {attachError && <p className={styles.attachError}>{attachError}</p>}

      <div className={styles.inputRow}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          className={styles.fileInput}
          onChange={(e) => void handlePickImages(e.target.files)}
          disabled={running || attachments.length >= maxPromptImages()}
        />
        <button
          type="button"
          className={styles.attachBtn}
          onClick={() => fileInputRef.current?.click()}
          disabled={running || attachments.length >= maxPromptImages()}
          title={`Attach reference image (max ${maxPromptImages()})`}
          aria-label="Attach reference image"
        >
          Ref
        </button>
        <textarea
          className={styles.input}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={running}
          placeholder={
            canRefine
              ? "Refine the dashboard — describe changes or attach a reference screenshot"
              : "Describe your dashboard — layout, metrics, colors — or attach a reference screenshot"
          }
        />
        <button type="submit" className={styles.sendBtn} disabled={!canSend}>
          {running ? <span className={styles.sendSpinner} aria-hidden /> : "↑"}
        </button>
      </div>

      <p className={styles.hint}>
        Enter to send · Shift+Enter for new line · Attach up to {maxPromptImages()} reference images (PNG/JPEG/WebP/GIF, 4MB each)
      </p>
    </form>
  );
}
