import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveChatErrorContent,
  streamLinesForErrorDisplay,
} from "./chatErrorMessage.ts";
import type { ChatMessage } from "./chatTypes.ts";

describe("resolveChatErrorContent", () => {
  it("prefers message.content", () => {
    const message: ChatMessage = {
      id: "a1",
      role: "assistant",
      content: "No Cursor API key configured.",
      error: true,
      lines: [{ type: "error", content: "hidden" }],
    };
    assert.equal(
      resolveChatErrorContent(message),
      "No Cursor API key configured.",
    );
  });

  it("falls back to the last streamed error line", () => {
    const message: ChatMessage = {
      id: "a1",
      role: "assistant",
      content: "",
      error: true,
      lines: [
        { type: "tool", content: "Writing main.lua" },
        { type: "error", content: "Startup failed: sandbox requires WSL2" },
      ],
    };
    assert.equal(
      resolveChatErrorContent(message),
      "Startup failed: sandbox requires WSL2",
    );
  });

  it("uses a generic fallback when nothing is available", () => {
    const message: ChatMessage = {
      id: "a1",
      role: "assistant",
      content: "",
      error: true,
    };
    assert.equal(resolveChatErrorContent(message), "Something went wrong.");
  });
});

describe("streamLinesForErrorDisplay", () => {
  it("omits error lines so the alert box is not duplicated", () => {
    const message: ChatMessage = {
      id: "a1",
      role: "assistant",
      content: "boom",
      error: true,
      lines: [
        { type: "tool", content: "validateWidget" },
        { type: "error", content: "boom" },
      ],
    };
    assert.deepEqual(streamLinesForErrorDisplay(message), [
      { type: "tool", content: "validateWidget" },
    ]);
  });
});
