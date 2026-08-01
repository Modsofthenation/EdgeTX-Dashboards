/** Supported AI backends for Generate / Refine. Cursor remains the default. */
export type AiProviderId = "cursor" | "anthropic" | "openai" | "gemini";

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
  {
    id: "gemini",
    label: "Gemini",
    keyLabel: "Gemini API key",
    keyPlaceholder: "AIza…",
    envVar: "GEMINI_API_KEY",
    header: "x-gemini-api-key",
  },
];

export function isAiProviderId(value: unknown): value is AiProviderId {
  return (
    value === "cursor" ||
    value === "anthropic" ||
    value === "openai" ||
    value === "gemini"
  );
}

export function parseAiProviderId(value: unknown): AiProviderId {
  return isAiProviderId(value) ? value : "cursor";
}

export function providerMeta(id: AiProviderId) {
  return AI_PROVIDERS.find((p) => p.id === id) ?? AI_PROVIDERS[0]!;
}

/** Join labels with an Oxford-style conjunction (no comma for exactly two items). */
export function formatList(
  items: readonly string[],
  conjunction: "and" | "or",
): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} ${conjunction} ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, ${conjunction} ${items[items.length - 1]}`;
}
