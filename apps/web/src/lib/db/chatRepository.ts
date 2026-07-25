import type { TelemetryProtocol } from "@widget-gen/shared";
import type { ChatMessage, ChatSummary, StoredChat, WidgetSnapshot, WidgetVersionEntry } from "~/lib/chatTypes";

export interface CreateChatInput {
  title: string;
  protocol: TelemetryProtocol;
  modelId: string;
  edgeTxVersion: string;
  radioId?: string;
}

export interface UpdateChatInput {
  title?: string;
  sessionId?: string | null;
  widgetName?: string | null;
  widgetInstanceId?: string | null;
  widgetVersion?: number;
  messages?: ChatMessage[];
  artifact?: WidgetSnapshot | null;
  artifactVersions?: WidgetVersionEntry[];
}

/** Persistence seam for chat history (SQLite in prod, in-memory in tests). */
export interface ChatRepository {
  listChats(limit?: number): ChatSummary[];
  getChat(id: string): StoredChat | null;
  createChat(input: CreateChatInput): StoredChat;
  updateChat(id: string, input: UpdateChatInput): StoredChat | null;
  deleteChat(id: string): boolean;
  clearAll?(): void;
}
