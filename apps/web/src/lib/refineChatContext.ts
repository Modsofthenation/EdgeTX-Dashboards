import type { RefineHistoryInput } from "@widget-gen/generator";
import type { ChatMessage, StoredChat } from "~/lib/chatTypes";

function messageText(message: ChatMessage): string {
  const direct = message.content.trim();
  if (direct) return direct;

  if (!message.lines?.length) return "";

  return message.lines
    .filter((line) => line.type === "text" || line.type === "done" || line.type === "status")
    .map((line) => line.content?.trim() ?? "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function buildRefineHistoryInput(
  chat: StoredChat,
  currentPrompt: string,
  workspaceLuaSource?: string | null
): RefineHistoryInput {
  return {
    messages: chat.messages.map((message) => ({
      role: message.role,
      content: messageText(message),
    })),
    currentPrompt,
    artifact: chat.artifact
      ? {
          version: chat.artifact.version,
          luaSource: chat.artifact.luaSource,
          validated: chat.artifact.validated,
        }
      : null,
    artifactVersions: (chat.artifactVersions ?? []).map((entry) => ({
      version: entry.version,
      luaSource: entry.luaSource,
      validated: entry.validated,
    })),
    workspaceLuaSource: workspaceLuaSource ?? null,
  };
}
