export const AI_API_KEY_SESSION_STORAGE = "widget-gen.ai.apiKey.session";
export const AI_API_KEY_LOCAL_STORAGE = "widget-gen.ai.apiKey.local";
export const AI_REMEMBER_KEY_STORAGE = "widget-gen.ai.rememberKey";
export const AI_DEFAULT_MODEL_STORAGE = "widget-gen.ai.defaultModelId";

export const CURSOR_API_KEY_HEADER = "x-cursor-api-key";

export type AiStatusResponse = {
  serverKeyConfigured: boolean;
  browserKeyAccepted: boolean;
  ready: boolean;
  catalogSource: "live" | "fallback";
  defaultModelId: string;
  modelCount: number;
};

export function readStoredApiKey(): { apiKey: string; remember: boolean } {
  if (typeof window === "undefined") {
    return { apiKey: "", remember: false };
  }
  try {
    const remember =
      window.localStorage.getItem(AI_REMEMBER_KEY_STORAGE) === "1";
    if (remember) {
      return {
        apiKey: window.localStorage.getItem(AI_API_KEY_LOCAL_STORAGE) ?? "",
        remember: true,
      };
    }
    return {
      apiKey: window.sessionStorage.getItem(AI_API_KEY_SESSION_STORAGE) ?? "",
      remember: false,
    };
  } catch {
    return { apiKey: "", remember: false };
  }
}

export function persistApiKey(apiKey: string, remember: boolean): void {
  if (typeof window === "undefined") return;
  const trimmed = apiKey.trim();
  try {
    if (remember) {
      window.localStorage.setItem(AI_REMEMBER_KEY_STORAGE, "1");
      if (trimmed) {
        window.localStorage.setItem(AI_API_KEY_LOCAL_STORAGE, trimmed);
      } else {
        window.localStorage.removeItem(AI_API_KEY_LOCAL_STORAGE);
      }
      window.sessionStorage.removeItem(AI_API_KEY_SESSION_STORAGE);
      return;
    }

    window.localStorage.removeItem(AI_REMEMBER_KEY_STORAGE);
    window.localStorage.removeItem(AI_API_KEY_LOCAL_STORAGE);
    if (trimmed) {
      window.sessionStorage.setItem(AI_API_KEY_SESSION_STORAGE, trimmed);
    } else {
      window.sessionStorage.removeItem(AI_API_KEY_SESSION_STORAGE);
    }
  } catch {
    // Storage may be unavailable (private mode / locked down).
  }
}

export function clearStoredApiKey(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(AI_API_KEY_SESSION_STORAGE);
    window.localStorage.removeItem(AI_API_KEY_LOCAL_STORAGE);
    window.localStorage.removeItem(AI_REMEMBER_KEY_STORAGE);
  } catch {
    // ignore
  }
}

export function readStoredDefaultModelId(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(AI_DEFAULT_MODEL_STORAGE) ?? "";
  } catch {
    return "";
  }
}

export function persistDefaultModelId(modelId: string): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed = modelId.trim();
    if (trimmed) {
      window.localStorage.setItem(AI_DEFAULT_MODEL_STORAGE, trimmed);
    } else {
      window.localStorage.removeItem(AI_DEFAULT_MODEL_STORAGE);
    }
  } catch {
    // ignore
  }
}

export function withCursorApiKeyHeaders(
  headers: HeadersInit | undefined,
  apiKey: string | null | undefined,
): Headers {
  const next = new Headers(headers);
  const trimmed = apiKey?.trim();
  if (trimmed) {
    next.set(CURSOR_API_KEY_HEADER, trimmed);
  }
  return next;
}
