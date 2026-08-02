import type { AiProviderId } from "@widget-gen/shared";
import {
  AI_PROVIDERS,
  parseAiProviderId,
  providerMeta,
} from "@widget-gen/shared";

export const AI_PROVIDER_STORAGE = "widget-gen.ai.provider";
export const AI_API_KEY_SESSION_STORAGE = "widget-gen.ai.apiKey.session";
export const AI_API_KEY_LOCAL_STORAGE = "widget-gen.ai.apiKey.local";
export const AI_REMEMBER_KEY_STORAGE = "widget-gen.ai.rememberKey";
export const AI_DEFAULT_MODEL_STORAGE = "widget-gen.ai.defaultModelId";

export const CURSOR_API_KEY_HEADER = "x-cursor-api-key";
export const AI_PROVIDER_HEADER = "x-ai-provider";

export type AiStatusResponse = {
  provider: AiProviderId;
  providerLabel: string;
  serverKeyConfigured: boolean;
  browserKeyAccepted: boolean;
  ready: boolean;
  catalogSource: "live" | "fallback" | "api";
  defaultModelId: string;
  modelCount: number;
};

function keyStorageKeys(provider: AiProviderId): {
  session: string;
  local: string;
} {
  if (provider === "cursor") {
    return {
      session: AI_API_KEY_SESSION_STORAGE,
      local: AI_API_KEY_LOCAL_STORAGE,
    };
  }
  return {
    session: `widget-gen.ai.apiKey.${provider}.session`,
    local: `widget-gen.ai.apiKey.${provider}.local`,
  };
}

function modelStorageKey(provider: AiProviderId): string {
  if (provider === "cursor") return AI_DEFAULT_MODEL_STORAGE;
  return `widget-gen.ai.defaultModelId.${provider}`;
}

export function readStoredProvider(): AiProviderId {
  if (typeof window === "undefined") return "cursor";
  try {
    return parseAiProviderId(window.localStorage.getItem(AI_PROVIDER_STORAGE));
  } catch {
    return "cursor";
  }
}

export function persistProvider(provider: AiProviderId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      AI_PROVIDER_STORAGE,
      parseAiProviderId(provider),
    );
  } catch {
    // ignore
  }
}

export function readStoredApiKey(
  provider: AiProviderId = readStoredProvider(),
): { apiKey: string; remember: boolean } {
  if (typeof window === "undefined") {
    return { apiKey: "", remember: false };
  }
  try {
    const remember =
      window.localStorage.getItem(AI_REMEMBER_KEY_STORAGE) === "1";
    const keys = keyStorageKeys(provider);
    if (remember) {
      return {
        apiKey: window.localStorage.getItem(keys.local) ?? "",
        remember: true,
      };
    }
    return {
      apiKey: window.sessionStorage.getItem(keys.session) ?? "",
      remember: false,
    };
  } catch {
    return { apiKey: "", remember: false };
  }
}

export function persistApiKey(
  apiKey: string,
  remember: boolean,
  provider: AiProviderId = readStoredProvider(),
): void {
  if (typeof window === "undefined") return;
  const trimmed = apiKey.trim();
  const keys = keyStorageKeys(provider);
  try {
    if (remember) {
      window.localStorage.setItem(AI_REMEMBER_KEY_STORAGE, "1");
      if (trimmed) {
        window.localStorage.setItem(keys.local, trimmed);
      } else {
        window.localStorage.removeItem(keys.local);
      }
      window.sessionStorage.removeItem(keys.session);
      return;
    }

    window.localStorage.removeItem(AI_REMEMBER_KEY_STORAGE);
    window.localStorage.removeItem(keys.local);
    if (trimmed) {
      window.sessionStorage.setItem(keys.session, trimmed);
    } else {
      window.sessionStorage.removeItem(keys.session);
    }
  } catch {
    // Storage may be unavailable (private mode / locked down).
  }
}

export function clearStoredApiKey(
  provider: AiProviderId = readStoredProvider(),
): void {
  if (typeof window === "undefined") return;
  const keys = keyStorageKeys(provider);
  try {
    window.sessionStorage.removeItem(keys.session);
    window.localStorage.removeItem(keys.local);
    // Keep remember flag — other providers may still use it.
  } catch {
    // ignore
  }
}

export function readStoredDefaultModelId(
  provider: AiProviderId = readStoredProvider(),
): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(modelStorageKey(provider)) ?? "";
  } catch {
    return "";
  }
}

export function persistDefaultModelId(
  modelId: string,
  provider: AiProviderId = readStoredProvider(),
): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed = modelId.trim();
    const key = modelStorageKey(provider);
    if (trimmed) {
      window.localStorage.setItem(key, trimmed);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

export function withCursorApiKeyHeaders(
  headers: HeadersInit | undefined,
  apiKey: string | null | undefined,
): Headers {
  return withProviderAuthHeaders(headers, "cursor", apiKey);
}

export function withProviderAuthHeaders(
  headers: HeadersInit | undefined,
  provider: AiProviderId,
  apiKey: string | null | undefined,
): Headers {
  const next = new Headers(headers);
  const resolved = parseAiProviderId(provider);
  next.set(AI_PROVIDER_HEADER, resolved);
  const trimmed = apiKey?.trim();
  if (trimmed) {
    next.set(providerMeta(resolved).header, trimmed);
  }
  return next;
}

export { AI_PROVIDERS };
