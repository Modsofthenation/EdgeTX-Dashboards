import type { ChatMessage } from "~/lib/chatTypes";

/** Prefer explicit content, then the last streamed error line. */
export function resolveChatErrorContent(message: ChatMessage): string {
  const direct = message.content?.trim();
  if (direct) return direct;

  const lines = message.lines ?? [];
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (line.type === "error") {
      const text = line.content?.trim();
      if (text) return text;
    }
  }

  return "Something went wrong.";
}

/** Stream lines to keep visible above an error box (omit duplicate error lines). */
export function streamLinesForErrorDisplay(
  message: ChatMessage,
): NonNullable<ChatMessage["lines"]> {
  return (message.lines ?? []).filter((line) => line.type !== "error");
}
