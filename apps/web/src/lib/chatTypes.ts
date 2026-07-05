import type { TelemetryProtocol, ValidationIssue } from "@widget-gen/shared";
import { appendStreamLine, type StreamLine } from "@/lib/streamLines";

export interface WidgetSnapshot {
  /** EdgeTX radio display name (≤10 chars). */
  name: string;
  /** UUID workspace folder — unique per chat widget. */
  instanceId: string | null;
  /** Number of refines applied (0 = initial generation). */
  version: number;
  luaSource: string | null;
  validated: boolean;
  validationIssues: ValidationIssue[];
}

/** Immutable snapshot stored when a generate/refine run completes. */
export interface WidgetVersionEntry {
  version: number;
  name: string;
  instanceId: string | null;
  luaSource: string | null;
  validated: boolean;
  validationIssues: ValidationIssue[];
  createdAt: number;
  messageId?: string | null;
}

export function snapshotToVersionEntry(
  snapshot: WidgetSnapshot,
  createdAt = Date.now(),
  messageId?: string | null
): WidgetVersionEntry {
  return {
    version: snapshot.version,
    name: snapshot.name,
    instanceId: snapshot.instanceId,
    luaSource: snapshot.luaSource,
    validated: snapshot.validated,
    validationIssues: snapshot.validationIssues,
    createdAt,
    messageId: messageId ?? null,
  };
}

export function versionEntryToSnapshot(entry: WidgetVersionEntry): WidgetSnapshot {
  return {
    name: entry.name,
    instanceId: entry.instanceId,
    version: entry.version,
    luaSource: entry.luaSource,
    validated: entry.validated,
    validationIssues: entry.validationIssues,
  };
}

export function formatVersionOptionLabel(version: number, latestVersion: number): string {
  if (version === 0) return "v0 — Initial generation";
  if (version === latestVersion) return `v${version} — Latest`;
  return `v${version} — Refine ${version}`;
}

export interface ChatSummary {
  id: string;
  title: string;
  protocol: TelemetryProtocol;
  modelId: string;
  widgetName: string | null;
  widgetInstanceId: string | null;
  widgetVersion: number;
  validated: boolean;
  updatedAt: number;
  messageCount: number;
}

export interface StoredChat {
  id: string;
  title: string;
  sessionId: string | null;
  protocol: TelemetryProtocol;
  modelId: string;
  edgeTxVersion: string;
  radioId: string;
  widgetName: string | null;
  widgetInstanceId: string | null;
  widgetVersion: number;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  artifact: WidgetSnapshot | null;
  artifactVersions: WidgetVersionEntry[];
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
  radioId: string;
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
  options: {
    instanceId?: string | null;
    widgetName?: string | null;
    version?: number;
  }
): Promise<{ source: string; name: string; instanceId: string | null; version: number } | null> {
  const params = new URLSearchParams();
  if (options.instanceId) {
    params.set("instanceId", options.instanceId);
  } else if (options.widgetName) {
    params.set("name", options.widgetName);
  } else if (sessionId && options.version === undefined) {
    params.set("sessionId", sessionId);
  } else {
    return null;
  }
  if (options.version !== undefined) {
    params.set("version", String(options.version));
  }

  const res = await fetch(`/api/widget-source?${params}`);
  if (res.status === 204 || !res.ok) return null;

  const source = await res.text();
  if (!source || source.startsWith("{")) return null;

  const name = res.headers.get("X-Widget-Name") ?? options.widgetName ?? "";
  const instanceId = res.headers.get("X-Widget-Instance-Id");
  const versionHeader = res.headers.get("X-Widget-Version");
  const version = versionHeader ? Number.parseInt(versionHeader, 10) : 0;

  return {
    source,
    name,
    instanceId: instanceId || options.instanceId || null,
    version: Number.isFinite(version) ? version : 0,
  };
}
