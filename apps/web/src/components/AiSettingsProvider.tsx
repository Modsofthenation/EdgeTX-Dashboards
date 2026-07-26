"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AiProviderId } from "@widget-gen/shared";
import { parseAiProviderId } from "@widget-gen/shared";
import {
  clearStoredApiKey,
  persistApiKey,
  persistDefaultModelId,
  persistProvider,
  readStoredApiKey,
  readStoredDefaultModelId,
  readStoredProvider,
  withProviderAuthHeaders,
  type AiStatusResponse,
} from "~/lib/aiSettings";
import { invalidateModelCatalogCache } from "~/lib/modelCatalog";

type AiSettingsContextValue = {
  provider: AiProviderId;
  /** Saved browser API key for the selected provider. */
  apiKey: string;
  rememberKey: boolean;
  preferredModelId: string;
  status: AiStatusResponse | null;
  statusLoading: boolean;
  statusError: string | null;
  ready: boolean;
  /** True after localStorage hydration (api key / preferred model). */
  hydrated: boolean;
  setProvider: (provider: AiProviderId) => Promise<AiStatusResponse | null>;
  saveApiKey: (apiKey: string, remember: boolean) => Promise<AiStatusResponse>;
  clearApiKey: () => Promise<void>;
  setPreferredModelId: (modelId: string) => void;
  refreshStatus: () => Promise<AiStatusResponse | null>;
  authHeaders: (headers?: HeadersInit) => Headers;
};

const AiSettingsContext = createContext<AiSettingsContextValue | null>(null);

async function fetchAiStatus(
  provider: AiProviderId,
  apiKey: string,
): Promise<AiStatusResponse> {
  const response = await fetch("/api/ai/status", {
    headers: withProviderAuthHeaders(undefined, provider, apiKey),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`AI status failed (${response.status})`);
  }
  return (await response.json()) as AiStatusResponse;
}

export function AiSettingsProvider({ children }: { children: ReactNode }) {
  const [provider, setProviderState] = useState<AiProviderId>("cursor");
  const [apiKey, setApiKey] = useState("");
  const [rememberKey, setRememberKey] = useState(false);
  const [preferredModelId, setPreferredModelIdState] = useState("");
  const [status, setStatus] = useState<AiStatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const nextProvider = readStoredProvider();
    const stored = readStoredApiKey(nextProvider);
    setProviderState(nextProvider);
    setApiKey(stored.apiKey);
    setRememberKey(stored.remember);
    setPreferredModelIdState(readStoredDefaultModelId(nextProvider));
    setHydrated(true);
  }, []);

  const refreshStatus =
    useCallback(async (): Promise<AiStatusResponse | null> => {
      setStatusLoading(true);
      setStatusError(null);
      try {
        const next = await fetchAiStatus(provider, apiKey);
        setStatus(next);
        return next;
      } catch (error) {
        setStatusError(error instanceof Error ? error.message : String(error));
        setStatus(null);
        return null;
      } finally {
        setStatusLoading(false);
      }
    }, [apiKey, provider]);

  useEffect(() => {
    if (!hydrated) return;
    void refreshStatus();
  }, [hydrated, refreshStatus]);

  const setProvider = useCallback(
    async (nextProviderRaw: AiProviderId): Promise<AiStatusResponse | null> => {
      const nextProvider = parseAiProviderId(nextProviderRaw);
      persistProvider(nextProvider);
      invalidateModelCatalogCache();
      const stored = readStoredApiKey(nextProvider);
      setProviderState(nextProvider);
      setApiKey(stored.apiKey);
      setRememberKey(stored.remember);
      setPreferredModelIdState(readStoredDefaultModelId(nextProvider));
      setStatusLoading(true);
      setStatusError(null);
      try {
        const next = await fetchAiStatus(nextProvider, stored.apiKey);
        setStatus(next);
        return next;
      } catch (error) {
        setStatusError(error instanceof Error ? error.message : String(error));
        setStatus(null);
        return null;
      } finally {
        setStatusLoading(false);
      }
    },
    [],
  );

  const saveApiKey = useCallback(
    async (nextKey: string, remember: boolean): Promise<AiStatusResponse> => {
      const trimmed = nextKey.trim();
      persistApiKey(trimmed, remember, provider);
      invalidateModelCatalogCache();
      setApiKey(trimmed);
      setRememberKey(remember);
      setStatusLoading(true);
      setStatusError(null);
      try {
        const next = await fetchAiStatus(provider, trimmed);
        setStatus(next);
        return next;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatusError(message);
        throw error;
      } finally {
        setStatusLoading(false);
      }
    },
    [provider],
  );

  const clearApiKey = useCallback(async () => {
    clearStoredApiKey(provider);
    invalidateModelCatalogCache();
    setApiKey("");
    setStatusLoading(true);
    setStatusError(null);
    try {
      const next = await fetchAiStatus(provider, "");
      setStatus(next);
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : String(error));
      setStatus(null);
    } finally {
      setStatusLoading(false);
    }
  }, [provider]);

  const setPreferredModelId = useCallback(
    (modelId: string) => {
      const trimmed = modelId.trim();
      persistDefaultModelId(trimmed, provider);
      setPreferredModelIdState(trimmed);
    },
    [provider],
  );

  const authHeaders = useCallback(
    (headers?: HeadersInit) =>
      withProviderAuthHeaders(headers, provider, apiKey),
    [apiKey, provider],
  );

  const value = useMemo<AiSettingsContextValue>(
    () => ({
      provider,
      apiKey,
      rememberKey,
      preferredModelId,
      status,
      statusLoading,
      statusError,
      ready: Boolean(status?.ready),
      hydrated,
      setProvider,
      saveApiKey,
      clearApiKey,
      setPreferredModelId,
      refreshStatus,
      authHeaders,
    }),
    [
      provider,
      apiKey,
      rememberKey,
      preferredModelId,
      status,
      statusLoading,
      statusError,
      hydrated,
      setProvider,
      saveApiKey,
      clearApiKey,
      setPreferredModelId,
      refreshStatus,
      authHeaders,
    ],
  );

  return (
    <AiSettingsContext.Provider value={value}>
      {children}
    </AiSettingsContext.Provider>
  );
}

export function useAiSettings(): AiSettingsContextValue {
  const ctx = useContext(AiSettingsContext);
  if (!ctx) {
    throw new Error("useAiSettings must be used within AiSettingsProvider");
  }
  return ctx;
}

/** Safe for components that may render outside the provider during tests. */
export function useOptionalAiSettings(): AiSettingsContextValue | null {
  return useContext(AiSettingsContext);
}
