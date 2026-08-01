import type { AiProviderId } from "@widget-gen/shared";
import type { ModelCatalogEntry } from "../models.ts";
import {
  DEFAULT_MODEL_ID,
  FALLBACK_MODELS,
  listAvailableModels,
} from "../models.ts";

export const ANTHROPIC_MODELS: ModelCatalogEntry[] = [
  {
    id: "claude-sonnet-4-20250514",
    label: "Claude Sonnet 4",
    description: "Strong coding + tool use (recommended)",
  },
  {
    id: "claude-opus-4-20250514",
    label: "Claude Opus 4",
    description: "Highest quality, slower",
  },
  {
    id: "claude-haiku-4-5-20251001",
    label: "Claude Haiku 4.5",
    description: "Fast and inexpensive",
  },
];

export const OPENAI_MODELS: ModelCatalogEntry[] = [
  {
    id: "gpt-4.1",
    label: "GPT-4.1",
    description: "Strong general coding model",
  },
  {
    id: "gpt-4.1-mini",
    label: "GPT-4.1 Mini",
    description: "Faster / cheaper",
  },
  {
    id: "o4-mini",
    label: "o4-mini",
    description: "Reasoning-oriented mini model",
  },
];

export function defaultModelForProvider(provider: AiProviderId): string {
  if (provider === "anthropic") return ANTHROPIC_MODELS[0]!.id;
  if (provider === "openai") return OPENAI_MODELS[0]!.id;
  return DEFAULT_MODEL_ID;
}

function fallbackCatalog(provider: "anthropic" | "openai"): {
  models: ModelCatalogEntry[];
  defaultId: string;
  source: "fallback";
} {
  return {
    models: [...(provider === "anthropic" ? ANTHROPIC_MODELS : OPENAI_MODELS)],
    defaultId: defaultModelForProvider(provider),
    source: "fallback",
  };
}

function defaultIdForCatalog(
  provider: "anthropic" | "openai",
  models: ModelCatalogEntry[],
): string {
  const fallbackId = defaultModelForProvider(provider);
  return models.some((model) => model.id === fallbackId)
    ? fallbackId
    : models[0]!.id;
}

export async function listModelsForProvider(
  provider: AiProviderId,
  apiKey?: string,
): Promise<{
  models: ModelCatalogEntry[];
  defaultId: string;
  source: "api" | "fallback";
}> {
  if (provider === "anthropic") {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) return fallbackCatalog("anthropic");

    try {
      const response = await fetch(
        "https://api.anthropic.com/v1/models?limit=1000",
        {
          headers: {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
          },
        },
      );
      if (!response.ok) return fallbackCatalog("anthropic");

      const payload = (await response.json()) as {
        data?: Array<{ id?: unknown; display_name?: unknown }>;
      };
      const models = (payload.data ?? []).flatMap((model) =>
        typeof model.id === "string" && model.id
          ? [
              {
                id: model.id,
                label:
                  typeof model.display_name === "string" && model.display_name
                    ? model.display_name
                    : model.id,
              },
            ]
          : [],
      );
      if (models.length === 0) return fallbackCatalog("anthropic");

      return {
        models,
        defaultId: defaultIdForCatalog("anthropic", models),
        source: "api",
      };
    } catch {
      return fallbackCatalog("anthropic");
    }
  }
  if (provider === "openai") {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) return fallbackCatalog("openai");

    try {
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: { authorization: `Bearer ${key}` },
      });
      if (!response.ok) return fallbackCatalog("openai");

      const payload = (await response.json()) as {
        data?: Array<{ id?: unknown }>;
      };
      const staticById = new Map(
        OPENAI_MODELS.map((model) => [model.id, model]),
      );
      const liveIds = (payload.data ?? []).flatMap((model) =>
        typeof model.id === "string" && model.id ? [model.id] : [],
      );
      const filteredIds = liveIds.filter(
        (id) =>
          id.startsWith("gpt-") ||
          id.startsWith("o1") ||
          id.startsWith("o3") ||
          id.startsWith("o4") ||
          id.startsWith("chatgpt-") ||
          staticById.has(id),
      );
      const filteredIdSet = new Set(filteredIds);
      const preferred = OPENAI_MODELS.filter((model) =>
        filteredIdSet.has(model.id),
      );
      const preferredIds = new Set(preferred.map((model) => model.id));
      const models = [
        ...preferred,
        ...filteredIds
          .filter((id) => !preferredIds.has(id))
          .map((id) => ({ id, label: id })),
      ];
      if (models.length === 0) return fallbackCatalog("openai");

      return {
        models,
        defaultId: defaultIdForCatalog("openai", models),
        source: "api",
      };
    } catch {
      return fallbackCatalog("openai");
    }
  }
  const models = await listAvailableModels(apiKey);
  return {
    models,
    defaultId:
      models.find((m) => m.id === DEFAULT_MODEL_ID)?.id ??
      models[0]?.id ??
      DEFAULT_MODEL_ID,
    source:
      models === FALLBACK_MODELS || models.length === FALLBACK_MODELS.length
        ? apiKey
          ? "api"
          : "fallback"
        : "api",
  };
}

export function isAllowedModelForProvider(
  provider: AiProviderId,
  modelId: string,
  allowedIds?: string[],
): boolean {
  if (allowedIds) return allowedIds.includes(modelId);
  if (provider === "anthropic") {
    return ANTHROPIC_MODELS.some((m) => m.id === modelId);
  }
  if (provider === "openai") {
    return OPENAI_MODELS.some((m) => m.id === modelId);
  }
  return FALLBACK_MODELS.some((m) => m.id === modelId) || Boolean(modelId);
}
