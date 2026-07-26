/** Supported AI backends for Generate / Refine. Cursor remains the default. */
export type AiProviderId = "cursor" | "anthropic" | "openai";

export const AI_PROVIDERS: {
  id: AiProviderId;
  label: string;
  keyLabel: string;
  keyPlaceholder: string;
  envVar: string;
  header: string;
}[] = [
  {
    id: "cursor",
    label: "Cursor",
    keyLabel: "Cursor API key",
    keyPlaceholder: "key_…",
    envVar: "CURSOR_API_KEY",
    header: "x-cursor-api-key",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    keyLabel: "Anthropic API key",
    keyPlaceholder: "sk-ant-…",
    envVar: "ANTHROPIC_API_KEY",
    header: "x-anthropic-api-key",
  },
  {
    id: "openai",
    label: "OpenAI",
    keyLabel: "OpenAI API key",
    keyPlaceholder: "sk-…",
    envVar: "OPENAI_API_KEY",
    header: "x-openai-api-key",
  },
];

export function isAiProviderId(value: unknown): value is AiProviderId {
  return value === "cursor" || value === "anthropic" || value === "openai";
}

export function parseAiProviderId(value: unknown): AiProviderId {
  return isAiProviderId(value) ? value : "cursor";
}

export function providerMeta(id: AiProviderId) {
  return AI_PROVIDERS.find((p) => p.id === id) ?? AI_PROVIDERS[0]!;
}
