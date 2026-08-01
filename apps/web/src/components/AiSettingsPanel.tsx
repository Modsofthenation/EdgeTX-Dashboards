"use client";

import { useEffect, useId, useState } from "react";
import type { AiProviderId } from "@widget-gen/shared";
import { AI_PROVIDERS, providerMeta } from "@widget-gen/shared";
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
    provider,
    apiKey,
    rememberKey,
    preferredModelId,
    status,
    statusLoading,
    statusError,
    ready,
    hydrated,
    setProvider,
    saveApiKey,
    clearApiKey,
    setPreferredModelId,
  } = useAiSettings();

  const providerFieldId = useId();
  const keyFieldId = useId();
  const rememberId = useId();
  const modelFieldId = useId();

  const [draftKey, setDraftKey] = useState(apiKey);
  const [draftRemember, setDraftRemember] = useState(rememberKey);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [models, setModels] = useState<ChatModel[]>(FALLBACK_CHAT_MODELS);
  const [modelsLoading, setModelsLoading] = useState(false);

  const meta = providerMeta(provider);

  useEffect(() => {
    if (!hydrated) return;
    setDraftKey(apiKey);
    setDraftRemember(rememberKey);
  }, [apiKey, rememberKey, hydrated, provider]);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    setModelsLoading(true);
    void fetchModelCatalog({ apiKey, provider, force: true })
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
  }, [apiKey, provider, ready, hydrated]);

  if (!hydrated) {
    return (
      <section className={styles.panel} aria-busy="true">
        <p className={styles.hint}>Loading saved AI settings…</p>
      </section>
    );
  }

  const dirty =
    draftKey.trim() !== apiKey.trim() || draftRemember !== rememberKey;

  const handleProviderChange = async (next: AiProviderId) => {
    setSaving(true);
    setSaveMessage(null);
    try {
      await setProvider(next);
    } catch (error) {
      setSaveMessage(
        error instanceof Error ? error.message : "Failed to switch provider",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const next = await saveApiKey(draftKey, draftRemember);
      setSaveMessage(
        next.ready
          ? "API key saved. Generation is ready."
          : `Saved, but no usable ${meta.label} API key was accepted yet.`,
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

  const providerLabels = AI_PROVIDERS.map((p) => p.label)
    .join(", ")
    .replace(/, ([^,]+)$/, ", and $1");
  const providerEnvVars = AI_PROVIDERS.map((p) => p.envVar);

  return (
    <section className={styles.panel}>
      <p className={styles.hint}>
        Generation supports {providerLabels}. Configure a browser key here, or
        set the matching server env var (
        {providerEnvVars.map((env, i) => (
          <span key={env}>
            {i > 0 ? (i === providerEnvVars.length - 1 ? ", or " : ", ") : null}
            <code>{env}</code>
          </span>
        ))}
        ).
      </p>

      <label className={styles.label} htmlFor={providerFieldId}>
        AI provider
      </label>
      <select
        id={providerFieldId}
        className={styles.select}
        value={provider}
        disabled={saving}
        onChange={(e) =>
          void handleProviderChange(e.target.value as AiProviderId)
        }
      >
        {AI_PROVIDERS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>

      <div className={styles.statusRow} role="status">
        <span
          className={ready ? styles.statusDotReady : styles.statusDotOff}
          aria-hidden
        />
        <div className={styles.statusCopy}>
          <strong>
            {meta.label}: {statusLabel}
          </strong>
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
        {meta.keyLabel}
      </label>
      <input
        id={keyFieldId}
        className={styles.input}
        type="password"
        autoComplete="off"
        spellCheck={false}
        placeholder={meta.keyPlaceholder}
        value={draftKey}
        onChange={(e) => setDraftKey(e.target.value)}
      />
      <p className={styles.fieldHint}>
        Sent as <code>{meta.header}</code> with <code>x-ai-provider</code> to
        this app’s API routes. Never stored in chat history.
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
        Used for new chats with {meta.label}. You can still change the model per
        message in the composer.
      </p>
    </section>
  );
}
