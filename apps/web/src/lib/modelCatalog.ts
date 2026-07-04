import { DEFAULT_CHAT_MODEL, FALLBACK_CHAT_MODELS, type ChatModel, type ModelCatalog } from "@/lib/chatModels";

export type { ChatModel, ModelCatalog };

export async function fetchModelCatalog(): Promise<ModelCatalog> {
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

  return data;
}

export function findModel(catalog: ModelCatalog, modelId: string): ChatModel | undefined {
  return catalog.models.find((m) => m.id === modelId);
}
