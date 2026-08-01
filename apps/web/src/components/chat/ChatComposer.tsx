"use client";

import {
  memo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import type { TelemetryProtocol } from "@widget-gen/shared";
import type { ChatModel } from "~/lib/chatModels";
import {
  groupRadiosByLayout,
  LAYOUT_GROUP_LABELS,
  type RadioCatalogEntry,
} from "~/lib/radioCatalog";
import { PROTOCOL_BADGE_LABELS } from "~/lib/protocolLabels";
import { EDGE_TX_VERSION_OPTIONS } from "~/lib/edgeTxVersions";
import {
  maxPromptImages,
  readPromptImageFile,
  type PendingPromptImage,
} from "~/lib/promptImages";
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
  onStop?: () => void;
}

function AttachImageIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12.5 6.5v11M7.5 12h10"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <rect
        x="3.75"
        y="5.75"
        width="16.5"
        height="12.5"
        rx="2.25"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <circle cx="8.75" cy="10.25" r="1.25" fill="currentColor" />
    </svg>
  );
}

function RemoveIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M3 3l6 6M9 3 3 9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="4" y="4" width="8" height="8" rx="1.25" fill="currentColor" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v14M12 5l6 6M12 5 6 11"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export const ChatComposer = memo(function ChatComposer({
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
  onStop,
}: ChatComposerProps) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<PendingPromptImage[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);

  const selectedRadio = radios.find((r) => r.id === radioId);
  const radioGroups = groupRadiosByLayout(radios);
  const canSend =
    !running && (input.trim().length > 0 || attachments.length > 0);
  const attachDisabled = running || attachments.length >= maxPromptImages();

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
      setAttachError(`You can attach up to ${maxPromptImages()} images`);
      return;
    }

    const picked = Array.from(files).slice(0, remaining);
    try {
      const next = await Promise.all(
        picked.map((file) => readPromptImageFile(file)),
      );
      setAttachments((prev) => [...prev, ...next]);
    } catch (err) {
      setAttachError(
        err instanceof Error ? err.message : "Could not read image",
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((img) => img.id !== id));
    setAttachError(null);
  };

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    if (attachDisabled) return;
    dragDepthRef.current += 1;
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (attachDisabled) return;
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDragging(false);
    if (attachDisabled) return;
    void handlePickImages(e.dataTransfer.files);
  };

  const settingsLocked = running || canRefine;

  const modelOptions =
    !modelsLoading && modelId && !models.some((m) => m.id === modelId)
      ? [{ id: modelId, label: modelId }, ...models]
      : models;

  const showSettings = settingsOpen || canRefine;

  return (
    <form className={styles.composer} onSubmit={handleSubmit}>
      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.settingsToggle}
          onClick={() => setSettingsOpen((o) => !o)}
          aria-expanded={showSettings}
        >
          Settings
          <span className={styles.settingsChevron} aria-hidden>
            {showSettings ? "▾" : "▸"}
          </span>
        </button>

        {!showSettings && (
          <>
            {selectedRadio && (
              <span className={styles.metaChip}>
                {selectedRadio.lcdW}×{selectedRadio.lcdH}
                {selectedRadio.touch ? " · touch" : ""}
              </span>
            )}
            <span className={styles.protocolChip}>
              {PROTOCOL_BADGE_LABELS[protocol]}
            </span>
          </>
        )}

        {showSettings && (
          <>
            <label className={styles.selectWrap}>
              <span className={styles.selectLabel}>Radio</span>
              <select
                className={styles.select}
                value={radioId}
                onChange={(e) => onRadioChange(e.target.value)}
                disabled={settingsLocked}
                title={
                  settingsLocked
                    ? "Radio is locked for this chat session"
                    : undefined
                }
              >
                {[...radioGroups.entries()].map(([layoutKey, group]) => (
                  <optgroup
                    key={layoutKey}
                    label={LAYOUT_GROUP_LABELS[layoutKey] ?? layoutKey}
                  >
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
                disabled={
                  settingsLocked || modelsLoading || models.length === 0
                }
                title={
                  settingsLocked
                    ? "Model is locked for this chat session"
                    : undefined
                }
              >
                {modelsLoading && (
                  <option value={modelId}>Loading models…</option>
                )}
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
                onChange={(e) =>
                  onProtocolChange(e.target.value as TelemetryProtocol)
                }
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
                {EDGE_TX_VERSION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {selectedRadio && (
              <span className={styles.metaChip}>
                {selectedRadio.lcdW}×{selectedRadio.lcdH}
                {selectedRadio.touch ? " · touch" : ""}
              </span>
            )}

            <span
              className={styles.protocolChip}
              title={
                settingsLocked
                  ? "Protocol is locked for this chat session"
                  : undefined
              }
            >
              {PROTOCOL_BADGE_LABELS[protocol]}
              {settingsLocked ? " · locked" : ""}
            </span>

            {canRefine && (
              <span className={styles.refineHint}>
                Settings locked — refine this dashboard or start a new chat to
                change radio/protocol.
              </span>
            )}
          </>
        )}
      </div>

      <div className={styles.inputArea}>
        <div
          className={`${styles.inputShell} ${isDragging ? styles.inputShellDragging : ""}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {isDragging && !attachDisabled ? (
            <div className={styles.dropOverlay} aria-hidden>
              <span className={styles.dropOverlayIcon}>
                <AttachImageIcon />
              </span>
              <span className={styles.dropOverlayText}>
                Drop images to attach
              </span>
            </div>
          ) : null}

          {attachments.length > 0 ? (
            <div
              className={styles.attachmentStrip}
              aria-label="Attached images"
            >
              {attachments.map((img) => (
                <div key={img.id} className={styles.attachment}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.previewUrl}
                    alt=""
                    className={styles.attachmentThumb}
                  />
                  <div className={styles.attachmentMeta}>
                    <span className={styles.attachmentName} title={img.name}>
                      {img.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.attachmentRemove}
                    onClick={() => removeAttachment(img.id)}
                    disabled={running}
                    aria-label={`Remove ${img.name}`}
                  >
                    <RemoveIcon />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className={styles.inputRow}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              className={styles.fileInput}
              onChange={(e) => void handlePickImages(e.target.files)}
              disabled={attachDisabled}
              tabIndex={-1}
            />
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={attachDisabled}
              title={
                attachDisabled && attachments.length >= maxPromptImages()
                  ? `Maximum ${maxPromptImages()} images attached`
                  : "Attach images"
              }
              aria-label="Attach images"
            >
              <AttachImageIcon />
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
                  ? "Message the assistant…"
                  : "Describe your dashboard, or attach reference screenshots"
              }
            />
            <button
              type={running ? "button" : "submit"}
              className={`${styles.sendBtn} ${canSend || running ? styles.sendBtnActive : ""}`}
              disabled={running ? !onStop : !canSend}
              aria-label={running ? "Stop generation" : "Send message"}
              onClick={
                running
                  ? (e) => {
                      e.preventDefault();
                      onStop?.();
                    }
                  : undefined
              }
            >
              {running ? <StopIcon /> : <SendIcon />}
            </button>
          </div>
        </div>

        {attachError ? (
          <p className={styles.attachError}>{attachError}</p>
        ) : null}

        <p className={styles.hint}>
          Enter to send · Shift+Enter for new line · Up to {maxPromptImages()}{" "}
          images · PNG, JPEG, WebP, GIF · 4MB each
        </p>
      </div>
    </form>
  );
});
