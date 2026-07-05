import type { ChatMessage, ChatSummary, StoredChat, WidgetSnapshot, WidgetVersionEntry } from "@/lib/chatTypes";
import type { TelemetryProtocol } from "@widget-gen/shared";

export async function fetchChatList(): Promise<ChatSummary[]> {
  const res = await fetch("/api/chats");
  if (!res.ok) return [];
  const data = (await res.json()) as { chats: ChatSummary[] };
  return data.chats;
}

export async function fetchChat(id: string): Promise<StoredChat | null> {
  const res = await fetch(`/api/chats/${id}`);
  if (!res.ok) return null;
  return (await res.json()) as StoredChat;
}

export async function createChatRecord(input: {
  title: string;
  protocol: TelemetryProtocol;
  modelId: string;
  edgeTxVersion: string;
  radioId: string;
}): Promise<StoredChat | null> {
  const res = await fetch("/api/chats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) return null;
  return (await res.json()) as StoredChat;
}

export async function syncChatRecord(
  id: string,
  input: {
    sessionId?: string | null;
    widgetName?: string | null;
    widgetInstanceId?: string | null;
    widgetVersion?: number;
    messages?: ChatMessage[];
    artifact?: WidgetSnapshot | null;
    artifactVersions?: WidgetVersionEntry[];
  }
): Promise<StoredChat | null> {
  const payload = {
    sessionId: input.sessionId ?? null,
    widgetName: input.widgetName ?? null,
    widgetInstanceId: input.widgetInstanceId ?? null,
    widgetVersion: input.widgetVersion,
    messages: input.messages
      ?.filter((message) => !message.isStreaming)
      .map(({ isStreaming: _, widget: __, ...rest }) => rest),
    artifact: input.artifact ?? null,
    artifactVersions: input.artifactVersions,
  };

  let body: string;
  try {
    body = JSON.stringify(payload);
  } catch {
    return null;
  }

  const res = await fetch(`/api/chats/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (!res.ok) return null;
  return (await res.json()) as StoredChat;
}

export async function removeChatRecord(id: string): Promise<boolean> {
  const res = await fetch(`/api/chats/${id}`, { method: "DELETE" });
  return res.ok;
}

export async function restoreGeneratorSession(
  chatId: string
): Promise<{
  sessionId: string;
  widgetName: string;
  widgetInstanceId?: string;
  widgetVersion?: number;
} | null> {
  const res = await fetch("/api/sessions/restore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId }),
  });
  if (!res.ok) return null;
  return (await res.json()) as {
    sessionId: string;
    widgetName: string;
    widgetInstanceId?: string;
    widgetVersion?: number;
  };
}
