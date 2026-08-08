import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { describeToolUse } from "./toolDisplay.ts";
import { extractToolEventsFromMessage } from "./orchestrator.ts";

describe("describeToolUse", () => {
  it("formats Read with shortened path", () => {
    const info = describeToolUse("Read", {
      path: "packages/generator/src/agent.ts",
    });
    assert.equal(info.label, "Read");
    assert.equal(info.detail, "…/src/agent.ts");
  });

  it("never leaks absolute home paths", () => {
    const info = describeToolUse("Read", {
      path: "/home/ubuntu/.ssh/id_rsa",
    });
    assert.equal(info.label, "Read");
    assert.equal(info.detail, "…/.ssh/id_rsa");
    assert.doesNotMatch(info.detail ?? "", /^\/home/);
  });

  it("prefers generated/ relative segments", () => {
    const info = describeToolUse("Write", {
      path: "/workspace/generated/MyDash/main.lua",
    });
    assert.equal(info.detail, "generated/MyDash/main.lua");
  });

  it("sanitizes absolute paths in Shell commands", () => {
    const info = describeToolUse("Shell", {
      command: "cat /tmp/secret.txt",
    });
    assert.match(info.detail ?? "", /secret\.txt/);
    assert.doesNotMatch(info.detail ?? "", /\/tmp\//);
  });

  it("formats MCP with server and tool name", () => {
    const info = describeToolUse("CallMcpTool", {
      server: "cursor-app-control",
      toolName: "open_resource",
      description: "Open file in editor",
    });
    assert.equal(info.label, "MCP");
    assert.equal(info.detail, "cursor-app-control · open_resource");
  });

  it("returns todos for TodoWrite", () => {
    const info = describeToolUse("TodoWrite", {
      merge: true,
      todos: [
        { id: "1", content: "Wire chat API", status: "completed" },
        { id: "2", content: "Build sidebar", status: "in_progress" },
      ],
    });
    assert.equal(info.label, "Update todos");
    assert.equal(info.todos?.length, 2);
    assert.equal(info.todos?.[1].status, "in_progress");
  });

  it("formats Shell command", () => {
    const info = describeToolUse("Shell", {
      command: "npm run typecheck -w @widget-gen/web",
      description: "Typecheck web app",
    });
    assert.equal(info.label, "Terminal");
    assert.match(info.detail ?? "", /typecheck/);
  });
});

describe("extractToolEventsFromMessage", () => {
  it("emits todo stream event for TodoWrite tool calls", () => {
    const events = extractToolEventsFromMessage({
      type: "tool_call",
      agent_id: "a1",
      run_id: "r1",
      call_id: "c1",
      name: "TodoWrite",
      status: "completed",
      args: {
        todos: [{ id: "t1", content: "Add tests", status: "pending" }],
        merge: false,
      },
    });

    assert.equal(events.length, 1);
    assert.equal(events[0].type, "todo");
    assert.equal(events[0].todos?.[0].content, "Add tests");
  });

  it("emits tool event with detail for Read", () => {
    const events = extractToolEventsFromMessage({
      type: "tool_call",
      agent_id: "a1",
      run_id: "r1",
      call_id: "c1",
      name: "Read",
      status: "running",
      args: { path: "apps/web/src/lib/streamLines.ts" },
    });

    assert.equal(events[0].type, "tool");
    assert.equal(events[0].content, "Read");
    assert.ok(events[0].detail?.includes("streamLines.ts"));
  });
});
