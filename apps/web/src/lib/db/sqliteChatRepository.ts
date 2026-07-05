import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import type { TelemetryProtocol, ValidationIssue } from "@widget-gen/shared";
import type { ChatMessage, ChatSummary, StoredChat, WidgetSnapshot } from "@/lib/chatTypes";
import type { ChatRepository, CreateChatInput, UpdateChatInput } from "@/lib/db/chatRepository";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  session_id TEXT,
  protocol TEXT NOT NULL,
  model_id TEXT NOT NULL,
  edge_tx_version TEXT NOT NULL DEFAULT '2.11.0',
  radio_id TEXT NOT NULL DEFAULT 'tx15',
  widget_name TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL DEFAULT '',
  lines_json TEXT,
  error INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_artifacts (
  chat_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  lua_source TEXT,
  validated INTEGER NOT NULL DEFAULT 0,
  validation_issues_json TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at DESC);
`;

function titleFromPrompt(prompt: string): string {
  const line = prompt.trim().split(/\r?\n/)[0] ?? "New chat";
  return line.length > 72 ? `${line.slice(0, 69)}…` : line;
}

function rowToSummary(row: {
  id: string;
  title: string;
  protocol: string;
  model_id: string;
  widget_name: string | null;
  updated_at: number;
  message_count: number;
  validated: number | null;
}): ChatSummary {
  return {
    id: row.id,
    title: row.title,
    protocol: row.protocol as TelemetryProtocol,
    modelId: row.model_id,
    widgetName: row.widget_name,
    validated: row.validated === 1,
    updatedAt: row.updated_at,
    messageCount: row.message_count,
  };
}

export class SqliteChatRepository implements ChatRepository {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.exec(SCHEMA);
  }

  listChats(limit = 50): ChatSummary[] {
    const rows = this.db
      .prepare(
        `SELECT c.id, c.title, c.protocol, c.model_id, c.widget_name, c.updated_at,
                COUNT(m.id) AS message_count,
                COALESCE(a.validated, 0) AS validated
         FROM chats c
         LEFT JOIN chat_messages m ON m.chat_id = c.id
         LEFT JOIN chat_artifacts a ON a.chat_id = c.id
         GROUP BY c.id
         ORDER BY c.updated_at DESC
         LIMIT ?`
      )
      .all(limit) as Array<{
      id: string;
      title: string;
      protocol: string;
      model_id: string;
      widget_name: string | null;
      updated_at: number;
      message_count: number;
      validated: number | null;
    }>;

    return rows.map(rowToSummary);
  }

  getChat(id: string): StoredChat | null {
    const row = this.db
      .prepare(
        `SELECT id, title, session_id, protocol, model_id, edge_tx_version, radio_id, widget_name, created_at, updated_at
         FROM chats WHERE id = ?`
      )
      .get(id) as
      | {
          id: string;
          title: string;
          session_id: string | null;
          protocol: string;
          model_id: string;
          edge_tx_version: string;
          radio_id: string;
          widget_name: string | null;
          created_at: number;
          updated_at: number;
        }
      | undefined;

    if (!row) return null;

    const messageRows = this.db
      .prepare(
        `SELECT id, role, content, lines_json, error, sort_order
         FROM chat_messages WHERE chat_id = ? ORDER BY sort_order ASC`
      )
      .all(id) as Array<{
      id: string;
      role: string;
      content: string;
      lines_json: string | null;
      error: number;
      sort_order: number;
    }>;

    const messages: ChatMessage[] = messageRows.map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
      lines: m.lines_json ? (JSON.parse(m.lines_json) as ChatMessage["lines"]) : undefined,
      error: m.error === 1,
      isStreaming: false,
    }));

    const artifactRow = this.db
      .prepare(
        `SELECT name, lua_source, validated, validation_issues_json
         FROM chat_artifacts WHERE chat_id = ?`
      )
      .get(id) as
      | {
          name: string;
          lua_source: string | null;
          validated: number;
          validation_issues_json: string;
        }
      | undefined;

    const artifact: WidgetSnapshot | null = artifactRow
      ? {
          name: artifactRow.name,
          luaSource: artifactRow.lua_source,
          validated: artifactRow.validated === 1,
          validationIssues: JSON.parse(artifactRow.validation_issues_json) as ValidationIssue[],
        }
      : null;

    return {
      id: row.id,
      title: row.title,
      sessionId: row.session_id,
      protocol: row.protocol as TelemetryProtocol,
      modelId: row.model_id,
      edgeTxVersion: row.edge_tx_version,
      radioId: row.radio_id,
      widgetName: row.widget_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      messages,
      artifact,
    };
  }

  createChat(input: CreateChatInput): StoredChat {
    const id = randomUUID();
    const now = Date.now();
    const title = titleFromPrompt(input.title);

    this.db
      .prepare(
        `INSERT INTO chats (id, title, protocol, model_id, edge_tx_version, radio_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        title,
        input.protocol,
        input.modelId,
        input.edgeTxVersion,
        input.radioId ?? "tx15",
        now,
        now
      );

    return this.getChat(id)!;
  }

  private replaceMessages(chatId: string, messages: ChatMessage[]): void {
    const deleteStmt = this.db.prepare(`DELETE FROM chat_messages WHERE chat_id = ?`);
    const insertStmt = this.db.prepare(
      `INSERT INTO chat_messages (id, chat_id, role, content, lines_json, error, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    const tx = this.db.transaction(() => {
      deleteStmt.run(chatId);
      messages.forEach((message, index) => {
        const linesJson =
          message.lines && message.lines.length > 0 ? JSON.stringify(message.lines) : null;
        insertStmt.run(
          message.id,
          chatId,
          message.role,
          message.content,
          linesJson,
          message.error ? 1 : 0,
          index
        );
      });
    });
    tx();
  }

  private upsertArtifact(chatId: string, artifact: WidgetSnapshot): void {
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO chat_artifacts (chat_id, name, lua_source, validated, validation_issues_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(chat_id) DO UPDATE SET
           name = excluded.name,
           lua_source = excluded.lua_source,
           validated = excluded.validated,
           validation_issues_json = excluded.validation_issues_json,
           updated_at = excluded.updated_at`
      )
      .run(
        chatId,
        artifact.name,
        artifact.luaSource,
        artifact.validated ? 1 : 0,
        JSON.stringify(artifact.validationIssues),
        now
      );
  }

  updateChat(id: string, input: UpdateChatInput): StoredChat | null {
    const existing = this.getChat(id);
    if (!existing) return null;

    const now = Date.now();
    const fields: string[] = ["updated_at = ?"];
    const values: Array<string | number | null> = [now];

    if (input.title !== undefined) {
      fields.push("title = ?");
      values.push(input.title);
    }
    if (input.sessionId !== undefined) {
      fields.push("session_id = ?");
      values.push(input.sessionId);
    }
    if (input.widgetName !== undefined) {
      fields.push("widget_name = ?");
      values.push(input.widgetName);
    }

    values.push(id);
    this.db.prepare(`UPDATE chats SET ${fields.join(", ")} WHERE id = ?`).run(...values);

    if (input.messages) {
      const persistable = input.messages
        .filter((m) => !m.isStreaming)
        .map(({ isStreaming: _, ...rest }) => rest);
      this.replaceMessages(id, persistable);
    }

    if (input.artifact?.luaSource) {
      this.upsertArtifact(id, input.artifact);
    }

    return this.getChat(id);
  }

  deleteChat(id: string): boolean {
    const result = this.db.prepare(`DELETE FROM chats WHERE id = ?`).run(id);
    return result.changes > 0;
  }

  close(): void {
    this.db.close();
  }
}
