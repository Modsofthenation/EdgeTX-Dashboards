import {
  DEFAULT_CHAT_MODEL,
  FALLBACK_CHAT_MODELS,
  type ChatModel,
  type ModelCatalog,
} from "~/lib/chatModels";
import { withCursorApiKeyHeaders } from "~/lib/aiSettings";

export type { ChatModel, ModelCatalog };

const CLIENT_CACHE_KEY = "widget-gen:model-catalog";
const CLIENT_CACHE_MS = 24 * 60 * 60 * 1000;

interface ClientCacheEntry {
  fetchedAt: number;
  catalog: ModelCatalog;
  /** Fingerprint of the API key used when caching (empty = server/default). */
  keyFingerprint: string;
}

function keyFingerprint(apiKey: string | null | undefined): string {
  const trimmed = apiKey?.trim() ?? "";
  if (!trimmed) return "";
  // Avoid storing the key; a short length+prefix fingerprint is enough to bust cache.
  return `${trimmed.length}:${trimmed.slice(0, 4)}`;
}

function readClientCache(
  apiKey: string | null | undefined,
): ModelCatalog | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(CLIENT_CACHE_KEY);
    if (!raw) return null;

    const entry = JSON.parse(raw) as ClientCacheEntry;
    if (!entry.catalog?.models?.length) return null;
    if (Date.now() - entry.fetchedAt > CLIENT_CACHE_MS) return null;
    if ((entry.keyFingerprint ?? "") !== keyFingerprint(apiKey)) return null;

    return entry.catalog;
  } catch {
    return null;
  }
}

function writeClientCache(
  catalog: ModelCatalog,
  apiKey: string | null | undefined,
): void {
  if (typeof window === "undefined") return;

  try {
    const entry: ClientCacheEntry = {
      fetchedAt: Date.now(),
      catalog,
      keyFingerprint: keyFingerprint(apiKey),
    };
    window.localStorage.setItem(CLIENT_CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Ignore quota or privacy-mode failures.
  }
}

export function invalidateModelCatalogCache(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CLIENT_CACHE_KEY);
  } catch {
    // ignore
  }
}

export async function fetchModelCatalog(options?: {
  apiKey?: string | null;
  force?: boolean;
}): Promise<ModelCatalog> {
  const apiKey = options?.apiKey ?? null;
  if (!options?.force) {
    const cached = readClientCache(apiKey);
    if (cached) return cached;
  }

  const res = await fetch("/api/models", {
    headers: withCursorApiKeyHeaders(undefined, apiKey),
    cache: "no-store",
  });
  if (!res.ok) {
    return {
      defaultId: DEFAULT_CHAT_MODEL,
      models: FALLBACK_CHAT_MODELS,
      source: "fallback",
    };
  }

  const data = (await res.json()) as ModelCatalog;
  if (!data.models?.length) {
    return {
      defaultId: DEFAULT_CHAT_MODEL,
      models: FALLBACK_CHAT_MODELS,
      source: "fallback",
    };
  }

  writeClientCache(data, apiKey);
  return data;
}

export function findModel(
  catalog: ModelCatalog,
  modelId: string,
): ChatModel | undefined {
  return catalog.models.find((m) => m.id === modelId);
}
