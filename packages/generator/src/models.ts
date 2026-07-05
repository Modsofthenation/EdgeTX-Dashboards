import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Cursor } from "@cursor/sdk";
import { getRepoRoot } from "./knowledge.js";

export interface ModelCatalogEntry {
  id: string;
  label: string;
  description?: string;
}

export const FALLBACK_MODELS: ModelCatalogEntry[] = [
  {
    id: "composer-2.5",
    label: "Composer 2.5",
    description: "Fast, recommended for widget generation",
  },
  {
    id: "composer-2",
    label: "Composer 2",
    description: "Balanced speed and quality",
  },
  {
    id: "gpt-5.3-codex",
    label: "GPT-5.3 Codex",
    description: "Strong coding model",
  },
];

export const DEFAULT_MODEL_ID = "composer-2.5";

/** How long to reuse a fetched model list before calling Cursor again. */
export const MODEL_CATALOG_CACHE_MS = 24 * 60 * 60 * 1000;

interface ModelCatalogCache {
  models: ModelCatalogEntry[];
  ids: Set<string>;
  expires: number;
}

interface DiskCachePayload {
  fetchedAt: number;
  models: ModelCatalogEntry[];
}

let memoryCache: ModelCatalogCache | undefined;

function getCacheFilePath(): string {
  const dataDir = process.env.WIDGET_GEN_DATA_DIR ?? join(getRepoRoot(), "data");
  return join(dataDir, "model-catalog-cache.json");
}

function toMemoryCache(models: ModelCatalogEntry[], fetchedAt: number): ModelCatalogCache {
  return {
    models,
    ids: new Set(models.map((m) => m.id)),
    expires: fetchedAt + MODEL_CATALOG_CACHE_MS,
  };
}

function readDiskCache(): ModelCatalogCache | undefined {
  try {
    const path = getCacheFilePath();
    if (!existsSync(path)) return undefined;

    const payload = JSON.parse(readFileSync(path, "utf-8")) as DiskCachePayload;
    if (!Array.isArray(payload.models) || payload.models.length === 0) return undefined;

    const cache = toMemoryCache(payload.models, payload.fetchedAt);
    if (cache.expires <= Date.now()) return undefined;
    return cache;
  } catch {
    return undefined;
  }
}

function writeDiskCache(models: ModelCatalogEntry[], fetchedAt: number): void {
  try {
    const path = getCacheFilePath();
    mkdirSync(dirname(path), { recursive: true });
    const payload: DiskCachePayload = { fetchedAt, models };
    writeFileSync(path, JSON.stringify(payload), "utf-8");
  } catch {
    // Ignore cache write failures; in-memory cache still applies for this process.
  }
}

function hydrateMemoryCache(): void {
  if (memoryCache) return;
  memoryCache = readDiskCache();
}

function mapSdkModel(model: { id: string; displayName?: string; description?: string }): ModelCatalogEntry {
  return {
    id: model.id,
    label: model.displayName?.trim() || model.id,
    description: model.description,
  };
}

function pickDefaultId(models: ModelCatalogEntry[]): string {
  if (models.some((m) => m.id === DEFAULT_MODEL_ID)) {
    return DEFAULT_MODEL_ID;
  }
  return models[0]?.id ?? DEFAULT_MODEL_ID;
}

export function getDefaultModelId(models: ModelCatalogEntry[]): string {
  return pickDefaultId(models);
}

/** List models available to the authenticated Cursor API key (cached). */
export async function listAvailableModels(apiKey?: string): Promise<ModelCatalogEntry[]> {
  const key = apiKey ?? process.env.CURSOR_API_KEY;
  if (!key) {
    return [...FALLBACK_MODELS];
  }

  const now = Date.now();
  hydrateMemoryCache();
  if (memoryCache && memoryCache.expires > now) {
    return memoryCache.models;
  }

  try {
    const sdkModels = await Cursor.models.list({ apiKey: key });
    const models = sdkModels.length > 0 ? sdkModels.map(mapSdkModel) : [...FALLBACK_MODELS];

    memoryCache = toMemoryCache(models, now);
    writeDiskCache(models, now);
    return models;
  } catch {
    return [...FALLBACK_MODELS];
  }
}

export async function listAvailableModelIds(apiKey?: string): Promise<string[]> {
  const models = await listAvailableModels(apiKey);
  return models.map((m) => m.id);
}

export function isAllowedModelId(modelId: string, allowedModelIds?: string[]): boolean {
  const allowed = allowedModelIds ?? FALLBACK_MODELS.map((m) => m.id);
  return allowed.includes(modelId);
}

/** Clear in-memory and on-disk model cache (useful in tests). */
export function resetModelCatalogCache(): void {
  memoryCache = undefined;
  try {
    const path = getCacheFilePath();
    if (existsSync(path)) unlinkSync(path);
  } catch {
    // Ignore cache delete failures.
  }
}
