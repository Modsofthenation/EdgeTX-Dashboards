import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import type { TelemetryProtocol, ValidationIssue } from "@widget-gen/shared";
import type {
  ChatMessage,
  ChatSummary,
  StoredChat,
  WidgetSnapshot,
  WidgetVersionEntry,
} from "~/lib/chatTypes";
import type {
  ChatRepository,
  CreateChatInput,
  UpdateChatInput,
} from "~/lib/db/chatRepository";

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
CREATE INDEX IF NOT EXISTS idx_chats_created_at ON chats(created_at ASC);

CREATE TABLE IF NOT EXISTS chat_artifact_versions (
  chat_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  name TEXT NOT NULL,
  instance_id TEXT,
  lua_source TEXT,
  validated INTEGER NOT NULL DEFAULT 0,
  validation_issues_json TEXT NOT NULL DEFAULT '[]',
  message_id TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (chat_id, version),
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chat_artifact_versions_chat ON chat_artifact_versions(chat_id, version);
`;

function migrateSchema(db: Database.Database): void {
  const chatCols = db.prepare(`PRAGMA table_info(chats)`).all() as Array<{
    name: string;
  }>;
  const chatNames = new Set(chatCols.map((c) => c.name));
  if (!chatNames.has("widget_instance_id")) {
    db.exec(`ALTER TABLE chats ADD COLUMN widget_instance_id TEXT`);
  }
  if (!chatNames.has("widget_version")) {
    db.exec(
      `ALTER TABLE chats ADD COLUMN widget_version INTEGER NOT NULL DEFAULT 0`,
    );
  }

  const artifactCols = db
    .prepare(`PRAGMA table_info(chat_artifacts)`)
    .all() as Array<{ name: string }>;
  const artifactNames = new Set(artifactCols.map((c) => c.name));
  if (!artifactNames.has("instance_id")) {
    db.exec(`ALTER TABLE chat_artifacts ADD COLUMN instance_id TEXT`);
  }
  if (!artifactNames.has("version")) {
    db.exec(
      `ALTER TABLE chat_artifacts ADD COLUMN version INTEGER NOT NULL DEFAULT 0`,
    );
  }

  const versionsTable = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='chat_artifact_versions'`,
    )
    .get();
  if (!versionsTable) {
    db.exec(`
      CREATE TABLE chat_artifact_versions (
        chat_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        name TEXT NOT NULL,
        instance_id TEXT,
        lua_source TEXT,
        validated INTEGER NOT NULL DEFAULT 0,
        validation_issues_json TEXT NOT NULL DEFAULT '[]',
        message_id TEXT,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (chat_id, version),
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
      );
      CREATE INDEX idx_chat_artifact_versions_chat ON chat_artifact_versions(chat_id, version);
    `);
  }
}

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
  widget_instance_id: string | null;
  widget_version: number | null;
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
    widgetInstanceId: row.widget_instance_id,
    widgetVersion: row.widget_version ?? 0,
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
    migrateSchema(this.db);
  }

  listChats(limit = 50): ChatSummary[] {
    const rows = this.db
      .prepare(
        `SELECT c.id, c.title, c.protocol, c.model_id, c.widget_name, c.widget_instance_id, c.widget_version, c.updated_at,
                COUNT(m.id) AS message_count,
                COALESCE(a.validated, 0) AS validated
         FROM chats c
         LEFT JOIN chat_messages m ON m.chat_id = c.id
         LEFT JOIN chat_artifacts a ON a.chat_id = c.id
         GROUP BY c.id
         ORDER BY c.created_at ASC, c.rowid ASC
         LIMIT ?`,
      )
      .all(limit) as Array<{
      id: string;
      title: string;
      protocol: string;
      model_id: string;
      widget_name: string | null;
      widget_instance_id: string | null;
      widget_version: number | null;
      updated_at: number;
      message_count: number;
      validated: number | null;
    }>;

    return rows.map(rowToSummary);
  }

  getChat(id: string): StoredChat | null {
    const row = this.db
      .prepare(
        `SELECT id, title, session_id, protocol, model_id, edge_tx_version, radio_id, widget_name, widget_instance_id, widget_version, created_at, updated_at
         FROM chats WHERE id = ?`,
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
          widget_instance_id: string | null;
          widget_version: number | null;
          created_at: number;
          updated_at: number;
        }
      | undefined;

    if (!row) return null;

    const messageRows = this.db
      .prepare(
        `SELECT id, role, content, lines_json, error, sort_order
         FROM chat_messages WHERE chat_id = ? ORDER BY sort_order ASC`,
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
      lines: m.lines_json
        ? (JSON.parse(m.lines_json) as ChatMessage["lines"])
        : undefined,
      error: m.error === 1,
      isStreaming: false,
    }));

    const artifactRow = this.db
      .prepare(
        `SELECT name, instance_id, version, lua_source, validated, validation_issues_json
         FROM chat_artifacts WHERE chat_id = ?`,
      )
      .get(id) as
      | {
          name: string;
          instance_id: string | null;
          version: number | null;
          lua_source: string | null;
          validated: number;
          validation_issues_json: string;
        }
      | undefined;

    const artifact: WidgetSnapshot | null = artifactRow
      ? {
          name: artifactRow.name,
          instanceId: artifactRow.instance_id,
          version: artifactRow.version ?? 0,
          luaSource: artifactRow.lua_source,
          validated: artifactRow.validated === 1,
          validationIssues: JSON.parse(
            artifactRow.validation_issues_json,
          ) as ValidationIssue[],
        }
      : null;

    let artifactVersions = this.loadArtifactVersions(id);
    if (artifactVersions.length === 0 && artifact?.luaSource) {
      artifactVersions = [
        {
          version: artifact.version,
          name: artifact.name,
          instanceId: artifact.instanceId,
          luaSource: artifact.luaSource,
          validated: artifact.validated,
          validationIssues: artifact.validationIssues,
          createdAt: row.updated_at,
        },
      ];
    }

    return {
      id: row.id,
      title: row.title,
      sessionId: row.session_id,
      protocol: row.protocol as TelemetryProtocol,
      modelId: row.model_id,
      edgeTxVersion: row.edge_tx_version,
      radioId: row.radio_id,
      widgetName: row.widget_name,
      widgetInstanceId: row.widget_instance_id,
      widgetVersion: row.widget_version ?? 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      messages,
      artifact,
      artifactVersions,
    };
  }

  private loadArtifactVersions(chatId: string): WidgetVersionEntry[] {
    const rows = this.db
      .prepare(
        `SELECT version, name, instance_id, lua_source, validated, validation_issues_json, message_id, created_at
         FROM chat_artifact_versions WHERE chat_id = ? ORDER BY version ASC`,
      )
      .all(chatId) as Array<{
      version: number;
      name: string;
      instance_id: string | null;
      lua_source: string | null;
      validated: number;
      validation_issues_json: string;
      message_id: string | null;
      created_at: number;
    }>;

    return rows.map((row) => ({
      version: row.version,
      name: row.name,
      instanceId: row.instance_id,
      luaSource: row.lua_source,
      validated: row.validated === 1,
      validationIssues: JSON.parse(
        row.validation_issues_json,
      ) as ValidationIssue[],
      messageId: row.message_id,
      createdAt: row.created_at,
    }));
  }

  private replaceArtifactVersions(
    chatId: string,
    versions: WidgetVersionEntry[],
  ): void {
    const deleteStmt = this.db.prepare(
      `DELETE FROM chat_artifact_versions WHERE chat_id = ?`,
    );
    const insertStmt = this.db.prepare(
      `INSERT INTO chat_artifact_versions
        (chat_id, version, name, instance_id, lua_source, validated, validation_issues_json, message_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    const tx = this.db.transaction(() => {
      deleteStmt.run(chatId);
      for (const entry of versions) {
        if (!entry.luaSource) continue;
        insertStmt.run(
          chatId,
          entry.version,
          entry.name,
          entry.instanceId,
          entry.luaSource,
          entry.validated ? 1 : 0,
          JSON.stringify(entry.validationIssues),
          entry.messageId ?? null,
          entry.createdAt,
        );
      }
    });
    tx();
  }

  createChat(input: CreateChatInput): StoredChat {
    const id = randomUUID();
    const now = Date.now();
    const title = titleFromPrompt(input.title);

    this.db
      .prepare(
        `INSERT INTO chats (id, title, protocol, model_id, edge_tx_version, radio_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        title,
        input.protocol,
        input.modelId,
        input.edgeTxVersion,
        input.radioId ?? "tx15",
        now,
        now,
      );

    return this.getChat(id)!;
  }

  private replaceMessages(chatId: string, messages: ChatMessage[]): void {
    const deleteStmt = this.db.prepare(
      `DELETE FROM chat_messages WHERE chat_id = ?`,
    );
    const insertStmt = this.db.prepare(
      `INSERT INTO chat_messages (id, chat_id, role, content, lines_json, error, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );

    const tx = this.db.transaction(() => {
      deleteStmt.run(chatId);
      messages.forEach((message, index) => {
        const linesJson =
          message.lines && message.lines.length > 0
            ? JSON.stringify(message.lines)
            : null;
        insertStmt.run(
          message.id,
          chatId,
          message.role,
          message.content,
          linesJson,
          message.error ? 1 : 0,
          index,
        );
      });
    });
    tx();
  }

  private upsertArtifact(chatId: string, artifact: WidgetSnapshot): void {
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO chat_artifacts (chat_id, name, instance_id, version, lua_source, validated, validation_issues_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(chat_id) DO UPDATE SET
           name = excluded.name,
           instance_id = excluded.instance_id,
           version = excluded.version,
           lua_source = excluded.lua_source,
           validated = excluded.validated,
           validation_issues_json = excluded.validation_issues_json,
           updated_at = excluded.updated_at`,
      )
      .run(
        chatId,
        artifact.name,
        artifact.instanceId,
        artifact.version,
        artifact.luaSource,
        artifact.validated ? 1 : 0,
        JSON.stringify(artifact.validationIssues),
        now,
      );
  }

  private mergeArtifactVersion(
    chatId: string,
    artifact: WidgetSnapshot,
    now: number,
  ): void {
    this.db
      .prepare(
        `INSERT INTO chat_artifact_versions
          (chat_id, version, name, instance_id, lua_source, validated, validation_issues_json, message_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)
         ON CONFLICT(chat_id, version) DO UPDATE SET
           name = excluded.name,
           instance_id = excluded.instance_id,
           lua_source = COALESCE(chat_artifact_versions.lua_source, excluded.lua_source),
           validated = excluded.validated,
           validation_issues_json = excluded.validation_issues_json`,
      )
      .run(
        chatId,
        artifact.version,
        artifact.name,
        artifact.instanceId,
        artifact.luaSource,
        artifact.validated ? 1 : 0,
        JSON.stringify(artifact.validationIssues),
        now,
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
    if (input.widgetInstanceId !== undefined) {
      fields.push("widget_instance_id = ?");
      values.push(input.widgetInstanceId);
    }
    if (input.widgetVersion !== undefined) {
      fields.push("widget_version = ?");
      values.push(input.widgetVersion);
    }

    values.push(id);
    this.db
      .prepare(`UPDATE chats SET ${fields.join(", ")} WHERE id = ?`)
      .run(...values);

    if (input.messages) {
      const persistable = input.messages
        .filter((m) => !m.isStreaming)
        .map(({ isStreaming: _, ...rest }) => rest);
      this.replaceMessages(id, persistable);
    }

    if (input.artifact?.luaSource) {
      this.upsertArtifact(id, input.artifact);
    }

    if (input.artifactVersions !== undefined) {
      if (input.artifactVersions.length > 0) {
        this.replaceArtifactVersions(id, input.artifactVersions);
      }
    } else if (input.artifact?.luaSource) {
      this.mergeArtifactVersion(id, input.artifact, now);
    }

    return this.getChat(id);
  }

  deleteChat(id: string): boolean {
    const result = this.db.prepare(`DELETE FROM chats WHERE id = ?`).run(id);
    return result.changes > 0;
  }

  clearAll(): void {
    this.db.exec(
      `DELETE FROM chat_artifact_versions; DELETE FROM chat_artifacts; DELETE FROM chat_messages; DELETE FROM chats;`,
    );
  }

  close(): void {
    this.db.close();
  }
}
