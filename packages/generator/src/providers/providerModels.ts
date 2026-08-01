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

export const GEMINI_MODELS: ModelCatalogEntry[] = [
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    description: "Fast coding + tool use (recommended)",
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    description: "Highest quality, slower",
  },
  {
    id: "gemini-2.0-flash",
    label: "Gemini 2.0 Flash",
    description: "Previous-gen flash model",
  },
];

export function defaultModelForProvider(provider: AiProviderId): string {
  if (provider === "anthropic") return ANTHROPIC_MODELS[0]!.id;
  if (provider === "openai") return OPENAI_MODELS[0]!.id;
  if (provider === "gemini") return GEMINI_MODELS[0]!.id;
  return DEFAULT_MODEL_ID;
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
    return {
      models: [...ANTHROPIC_MODELS],
      defaultId: defaultModelForProvider("anthropic"),
      source: "fallback",
    };
  }
  if (provider === "openai") {
    return {
      models: [...OPENAI_MODELS],
      defaultId: defaultModelForProvider("openai"),
      source: "fallback",
    };
  }
  if (provider === "gemini") {
    return {
      models: [...GEMINI_MODELS],
      defaultId: defaultModelForProvider("gemini"),
      source: "fallback",
    };
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
  if (provider === "gemini") {
    return GEMINI_MODELS.some((m) => m.id === modelId);
  }
  return FALLBACK_MODELS.some((m) => m.id === modelId) || Boolean(modelId);
}
