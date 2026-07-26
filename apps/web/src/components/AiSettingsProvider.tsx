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
import {
  clearStoredApiKey,
  persistApiKey,
  persistDefaultModelId,
  readStoredApiKey,
  readStoredDefaultModelId,
  withCursorApiKeyHeaders,
  type AiStatusResponse,
} from "~/lib/aiSettings";
import { invalidateModelCatalogCache } from "~/lib/modelCatalog";

type AiSettingsContextValue = {
  /** Saved browser API key used for authenticated requests. */
  apiKey: string;
  rememberKey: boolean;
  preferredModelId: string;
  status: AiStatusResponse | null;
  statusLoading: boolean;
  statusError: string | null;
  ready: boolean;
  /** True after localStorage hydration (api key / preferred model). */
  hydrated: boolean;
  saveApiKey: (apiKey: string, remember: boolean) => Promise<AiStatusResponse>;
  clearApiKey: () => Promise<void>;
  setPreferredModelId: (modelId: string) => void;
  refreshStatus: () => Promise<AiStatusResponse | null>;
  authHeaders: (headers?: HeadersInit) => Headers;
};

const AiSettingsContext = createContext<AiSettingsContextValue | null>(null);

async function fetchAiStatus(apiKey: string): Promise<AiStatusResponse> {
  const response = await fetch("/api/ai/status", {
    headers: withCursorApiKeyHeaders(undefined, apiKey),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`AI status failed (${response.status})`);
  }
  return (await response.json()) as AiStatusResponse;
}

export function AiSettingsProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKey] = useState("");
  const [rememberKey, setRememberKey] = useState(false);
  const [preferredModelId, setPreferredModelIdState] = useState("");
  const [status, setStatus] = useState<AiStatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStoredApiKey();
    setApiKey(stored.apiKey);
    setRememberKey(stored.remember);
    setPreferredModelIdState(readStoredDefaultModelId());
    setHydrated(true);
  }, []);

  const refreshStatus =
    useCallback(async (): Promise<AiStatusResponse | null> => {
      setStatusLoading(true);
      setStatusError(null);
      try {
        const next = await fetchAiStatus(apiKey);
        setStatus(next);
        return next;
      } catch (error) {
        setStatusError(error instanceof Error ? error.message : String(error));
        setStatus(null);
        return null;
      } finally {
        setStatusLoading(false);
      }
    }, [apiKey]);

  useEffect(() => {
    if (!hydrated) return;
    void refreshStatus();
  }, [hydrated, refreshStatus]);

  const saveApiKey = useCallback(
    async (nextKey: string, remember: boolean): Promise<AiStatusResponse> => {
      const trimmed = nextKey.trim();
      persistApiKey(trimmed, remember);
      invalidateModelCatalogCache();
      setApiKey(trimmed);
      setRememberKey(remember);
      setStatusLoading(true);
      setStatusError(null);
      try {
        const next = await fetchAiStatus(trimmed);
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
    [],
  );

  const clearApiKey = useCallback(async () => {
    clearStoredApiKey();
    invalidateModelCatalogCache();
    setApiKey("");
    setRememberKey(false);
    setStatusLoading(true);
    setStatusError(null);
    try {
      const next = await fetchAiStatus("");
      setStatus(next);
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : String(error));
      setStatus(null);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const setPreferredModelId = useCallback((modelId: string) => {
    const trimmed = modelId.trim();
    persistDefaultModelId(trimmed);
    setPreferredModelIdState(trimmed);
  }, []);

  const authHeaders = useCallback(
    (headers?: HeadersInit) => withCursorApiKeyHeaders(headers, apiKey),
    [apiKey],
  );

  const value = useMemo<AiSettingsContextValue>(
    () => ({
      apiKey,
      rememberKey,
      preferredModelId,
      status,
      statusLoading,
      statusError,
      ready: Boolean(status?.ready),
      hydrated,
      saveApiKey,
      clearApiKey,
      setPreferredModelId,
      refreshStatus,
      authHeaders,
    }),
    [
      apiKey,
      rememberKey,
      preferredModelId,
      status,
      statusLoading,
      statusError,
      hydrated,
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
