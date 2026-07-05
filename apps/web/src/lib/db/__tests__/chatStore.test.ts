import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { SqliteChatRepository } from "../sqliteChatRepository.js";
import type { ChatMessage } from "../../chatTypes.js";

describe("SqliteChatRepository", () => {
  let repo: SqliteChatRepository;

  beforeEach(() => {
    repo = new SqliteChatRepository(":memory:");
  });

  afterEach(() => {
    repo.close();
  });

  it("round-trips create, update, list, and delete", () => {
    const created = repo.createChat({
      title: "Build a vibrant heli dashboard with headspeed",
      protocol: "rotorflight",
      modelId: "claude-sonnet-4",
      edgeTxVersion: "2.11.0",
      radioId: "tx15",
    });

    assert.ok(created.id);
    assert.equal(created.messages.length, 0);

    const userMsg: ChatMessage = {
      id: "u1",
      role: "user",
      content: "Build a vibrant heli dashboard",
    };
    const assistantMsg: ChatMessage = {
      id: "a1",
      role: "assistant",
      content: "",
      lines: [{ type: "text", content: "Working on it…" }],
    };

    const updated = repo.updateChat(created.id, {
      sessionId: "sess-1",
      widgetName: "heli_dash",
      messages: [userMsg, assistantMsg],
      artifact: {
        name: "heli_dash",
        instanceId: null,
        version: 0,
        luaSource: "return {}",
        validated: true,
        validationIssues: [],
      },
    });

    assert.ok(updated);
    assert.equal(updated!.sessionId, "sess-1");
    assert.equal(updated!.widgetName, "heli_dash");
    assert.equal(updated!.messages.length, 2);
    assert.equal(updated!.artifact?.name, "heli_dash");
    assert.equal(updated!.artifact?.validated, true);

    const listed = repo.listChats();
    assert.equal(listed.length, 1);
    assert.equal(listed[0].messageCount, 2);
    assert.equal(listed[0].validated, true);

    const loaded = repo.getChat(created.id);
    assert.equal(loaded?.messages[1].lines?.[0].content, "Working on it…");

    assert.equal(repo.deleteChat(created.id), true);
    assert.equal(repo.getChat(created.id), null);
  });

  it("preserves stored lua when update sends artifact without source", () => {
    const chat = repo.createChat({
      title: "test",
      protocol: "betaflight",
      modelId: "m1",
      edgeTxVersion: "2.11.0",
    });

    repo.updateChat(chat.id, {
      artifact: {
        name: "BfFltLogk7",
        instanceId: null,
        version: 0,
        luaSource: "local name = 'BfFltLogk7'",
        validated: true,
        validationIssues: [],
      },
    });

    repo.updateChat(chat.id, {
      artifact: {
        name: "BfFltLogk7",
        instanceId: null,
        version: 0,
        luaSource: null,
        validated: false,
        validationIssues: [],
      },
    });

    assert.equal(repo.getChat(chat.id)?.artifact?.luaSource, "local name = 'BfFltLogk7'");
    assert.equal(repo.getChat(chat.id)?.artifact?.validated, true);
  });

  it("clearAll removes every chat", () => {
    repo.createChat({
      title: "one",
      protocol: "betaflight",
      modelId: "m1",
      edgeTxVersion: "2.11.0",
    });
    repo.createChat({
      title: "two",
      protocol: "rotorflight",
      modelId: "m1",
      edgeTxVersion: "2.11.0",
    });
    assert.equal(repo.listChats().length, 2);
    repo.clearAll();
    assert.equal(repo.listChats().length, 0);
  });

  it("excludes streaming messages from persistence", () => {
    const chat = repo.createChat({
      title: "test",
      protocol: "betaflight",
      modelId: "m1",
      edgeTxVersion: "2.11.0",
    });

    repo.updateChat(chat.id, {
      messages: [
        { id: "u1", role: "user", content: "hi" },
        { id: "a1", role: "assistant", content: "", isStreaming: true, lines: [{ type: "text", content: "…" }] },
      ],
    });

    const loaded = repo.getChat(chat.id);
    assert.equal(loaded?.messages.length, 1);
    assert.equal(loaded?.messages[0].role, "user");
  });
});
