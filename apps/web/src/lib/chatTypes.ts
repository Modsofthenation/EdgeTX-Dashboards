import type { TelemetryProtocol, ValidationIssue } from "@widget-gen/shared";
import { appendStreamLine, type StreamLine } from "@/lib/streamLines";

export interface WidgetSnapshot {
  name: string;
  luaSource: string | null;
  validated: boolean;
  validationIssues: ValidationIssue[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  lines?: StreamLine[];
  isStreaming?: boolean;
  widget?: WidgetSnapshot;
  error?: boolean;
}

export interface ChatSendOptions {
  protocol: TelemetryProtocol;
  edgeTxVersion: string;
  modelId: string;
}

function newId(): string {
  return crypto.randomUUID();
}

export function createUserMessage(content: string): ChatMessage {
  return { id: newId(), role: "user", content };
}

export function createAssistantPlaceholder(): ChatMessage {
  return { id: newId(), role: "assistant", content: "", lines: [], isStreaming: true };
}

export function appendAssistantLine(messages: ChatMessage[], assistantId: string, line: StreamLine): ChatMessage[] {
  return messages.map((message) => {
    if (message.id !== assistantId || message.role !== "assistant") return message;
    return {
      ...message,
      lines: appendStreamLine(message.lines ?? [], line),
    };
  });
}

export function patchAssistant(
  messages: ChatMessage[],
  assistantId: string,
  patch: Partial<ChatMessage>
): ChatMessage[] {
  return messages.map((message) => (message.id === assistantId ? { ...message, ...patch } : message));
}

export async function fetchWidgetSource(
  sessionId: string | null,
  widgetName: string | null
): Promise<{ source: string; name: string } | null> {
  const params = new URLSearchParams();
  if (widgetName) {
    params.set("name", widgetName);
  } else if (sessionId) {
    params.set("sessionId", sessionId);
  } else {
    return null;
  }

  const res = await fetch(`/api/widget-source?${params}`);
  if (res.status === 204 || !res.ok) return null;

  const source = await res.text();
  if (!source || source.startsWith("{")) return null;

  const name = res.headers.get("X-Widget-Name") ?? widgetName ?? "";
  return { source, name };
}
