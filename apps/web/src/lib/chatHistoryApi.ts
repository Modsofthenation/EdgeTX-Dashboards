import type { ChatMessage, ChatSummary, StoredChat, WidgetSnapshot } from "@/lib/chatTypes";
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
    messages?: ChatMessage[];
    artifact?: WidgetSnapshot | null;
  }
): Promise<StoredChat | null> {
  const payload = {
    sessionId: input.sessionId ?? null,
    widgetName: input.widgetName ?? null,
    messages: input.messages
      ?.filter((message) => !message.isStreaming)
      .map(({ isStreaming: _, widget: __, ...rest }) => rest),
    artifact: input.artifact ?? null,
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
