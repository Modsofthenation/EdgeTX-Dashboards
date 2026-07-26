"use client";

import { useEffect, useId, useState } from "react";
import { useAiSettings } from "~/components/AiSettingsProvider";
import {
  DEFAULT_CHAT_MODEL,
  FALLBACK_CHAT_MODELS,
  type ChatModel,
} from "~/lib/chatModels";
import { fetchModelCatalog } from "~/lib/modelCatalog";
import styles from "./AiSettingsPanel.module.css";

export function AiSettingsPanel() {
  const {
    apiKey,
    rememberKey,
    preferredModelId,
    status,
    statusLoading,
    statusError,
    ready,
    hydrated,
    saveApiKey,
    clearApiKey,
    setPreferredModelId,
  } = useAiSettings();

  const keyFieldId = useId();
  const rememberId = useId();
  const modelFieldId = useId();

  const [draftKey, setDraftKey] = useState(apiKey);
  const [draftRemember, setDraftRemember] = useState(rememberKey);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [models, setModels] = useState<ChatModel[]>(FALLBACK_CHAT_MODELS);
  const [modelsLoading, setModelsLoading] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    setDraftKey(apiKey);
    setDraftRemember(rememberKey);
  }, [apiKey, rememberKey, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    setModelsLoading(true);
    void fetchModelCatalog({ apiKey, force: true })
      .then((catalog) => {
        if (cancelled) return;
        setModels(catalog.models);
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey, ready, hydrated]);

  if (!hydrated) {
    return (
      <section className={styles.panel} aria-busy="true">
        <p className={styles.hint}>Loading saved AI settings…</p>
      </section>
    );
  }

  const dirty =
    draftKey.trim() !== apiKey.trim() || draftRemember !== rememberKey;

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const next = await saveApiKey(draftKey, draftRemember);
      setSaveMessage(
        next.ready
          ? "API key saved. Generation is ready."
          : "Saved, but no usable Cursor API key was accepted yet.",
      );
    } catch (error) {
      setSaveMessage(
        error instanceof Error ? error.message : "Failed to save API key",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      await clearApiKey();
      setDraftKey("");
      setDraftRemember(false);
      setSaveMessage("Browser API key cleared.");
    } catch (error) {
      setSaveMessage(
        error instanceof Error ? error.message : "Failed to clear API key",
      );
    } finally {
      setSaving(false);
    }
  };

  const statusLabel = statusLoading
    ? "Checking…"
    : ready
      ? status?.browserKeyAccepted
        ? "Ready (browser key)"
        : "Ready (server key)"
      : "Not configured";

  return (
    <section className={styles.panel}>
      <p className={styles.hint}>
        Generation uses the Cursor Agent API. Configure a key here for this
        browser, or set <code>CURSOR_API_KEY</code> on the server.
      </p>

      <div className={styles.statusRow} role="status">
        <span
          className={ready ? styles.statusDotReady : styles.statusDotOff}
          aria-hidden
        />
        <div className={styles.statusCopy}>
          <strong>{statusLabel}</strong>
          {status ? (
            <span className={styles.statusMeta}>
              {status.modelCount} models · catalog {status.catalogSource}
              {status.serverKeyConfigured ? " · server key present" : ""}
            </span>
          ) : null}
          {statusError ? (
            <span className={styles.statusError}>{statusError}</span>
          ) : null}
        </div>
      </div>

      <label className={styles.label} htmlFor={keyFieldId}>
        Cursor API key
      </label>
      <input
        id={keyFieldId}
        className={styles.input}
        type="password"
        autoComplete="off"
        spellCheck={false}
        placeholder="key_…"
        value={draftKey}
        onChange={(e) => setDraftKey(e.target.value)}
      />
      <p className={styles.fieldHint}>
        Sent only as the <code>x-cursor-api-key</code> header to this app’s API
        routes. Never stored in chat history.
      </p>

      <label className={styles.checkRow} htmlFor={rememberId}>
        <input
          id={rememberId}
          type="checkbox"
          checked={draftRemember}
          onChange={(e) => setDraftRemember(e.target.checked)}
        />
        <span>
          Remember on this device
          <span className={styles.checkHint}>
            Stores the key in localStorage. Prefer session-only on shared
            machines.
          </span>
        </span>
      </label>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          disabled={saving || !dirty}
          onClick={() => void handleSave()}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className={styles.secondary}
          disabled={saving || (!apiKey && !draftKey)}
          onClick={() => void handleClear()}
        >
          Clear browser key
        </button>
      </div>
      {saveMessage ? <p className={styles.saveMessage}>{saveMessage}</p> : null}

      <label className={styles.label} htmlFor={modelFieldId}>
        Preferred default model
      </label>
      <select
        id={modelFieldId}
        className={styles.select}
        value={
          preferredModelId && models.some((m) => m.id === preferredModelId)
            ? preferredModelId
            : (status?.defaultModelId ?? models[0]?.id ?? DEFAULT_CHAT_MODEL)
        }
        disabled={modelsLoading || models.length === 0}
        onChange={(e) => setPreferredModelId(e.target.value)}
      >
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.label}
          </option>
        ))}
      </select>
      <p className={styles.fieldHint}>
        Used for new chats. You can still change the model per message in the
        composer.
      </p>
    </section>
  );
}
