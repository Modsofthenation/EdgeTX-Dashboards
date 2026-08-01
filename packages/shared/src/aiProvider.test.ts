import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatList, isAiProviderId } from "./aiProvider.ts";

describe("formatList", () => {
  it("handles zero, one, two, and many items", () => {
    assert.equal(formatList([], "and"), "");
    assert.equal(formatList(["Cursor"], "and"), "Cursor");
    assert.equal(formatList(["Cursor", "Gemini"], "and"), "Cursor and Gemini");
    assert.equal(
      formatList(["Cursor", "Anthropic", "OpenAI", "Gemini"], "or"),
      "Cursor, Anthropic, OpenAI, or Gemini",
    );
  });
});

describe("isAiProviderId", () => {
  it("accepts gemini", () => {
    assert.equal(isAiProviderId("gemini"), true);
    assert.equal(isAiProviderId("nope"), false);
  });
});
