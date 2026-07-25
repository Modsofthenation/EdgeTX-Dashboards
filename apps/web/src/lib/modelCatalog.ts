import { DEFAULT_CHAT_MODEL, FALLBACK_CHAT_MODELS, type ChatModel, type ModelCatalog } from "~/lib/chatModels";

export type { ChatModel, ModelCatalog };

const CLIENT_CACHE_KEY = "widget-gen:model-catalog";
const CLIENT_CACHE_MS = 24 * 60 * 60 * 1000;

interface ClientCacheEntry {
  fetchedAt: number;
  catalog: ModelCatalog;
}

function readClientCache(): ModelCatalog | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(CLIENT_CACHE_KEY);
    if (!raw) return null;

    const entry = JSON.parse(raw) as ClientCacheEntry;
    if (!entry.catalog?.models?.length) return null;
    if (Date.now() - entry.fetchedAt > CLIENT_CACHE_MS) return null;

    return entry.catalog;
  } catch {
    return null;
  }
}

function writeClientCache(catalog: ModelCatalog): void {
  if (typeof window === "undefined") return;

  try {
    const entry: ClientCacheEntry = { fetchedAt: Date.now(), catalog };
    window.localStorage.setItem(CLIENT_CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Ignore quota or privacy-mode failures.
  }
}

export async function fetchModelCatalog(): Promise<ModelCatalog> {
  const cached = readClientCache();
  if (cached) return cached;

  const res = await fetch("/api/models");
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

  writeClientCache(data);
  return data;
}

export function findModel(catalog: ModelCatalog, modelId: string): ChatModel | undefined {
  return catalog.models.find((m) => m.id === modelId);
}
