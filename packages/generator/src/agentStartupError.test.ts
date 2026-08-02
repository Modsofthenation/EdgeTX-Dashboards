import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CursorAgentError } from "@cursor/sdk";
import { formatAgentStartupError } from "./agentStartupError.ts";

describe("formatAgentStartupError", () => {
  it("prefixes CursorAgentError messages", () => {
    const err = new CursorAgentError("agent exploded");
    assert.equal(
      formatAgentStartupError(err),
      "Startup failed: agent exploded",
    );
  });

  it("adds a Windows sandbox / WSL hint", () => {
    const err = new CursorAgentError("Failed to start sandbox (WSL missing)");
    const text = formatAgentStartupError(err);
    assert.match(text, /^Startup failed:/);
    assert.match(text, /WSL2/i);
    assert.match(text, /CURSOR_SANDBOX_ENABLED/);
  });

  it("adds an auth hint for API key failures", () => {
    const text = formatAgentStartupError(new Error("Invalid API key"));
    assert.match(text, /Settings → AI/);
  });

  it("does not double-format an already annotated message", () => {
    const once = formatAgentStartupError(
      new CursorAgentError("sandbox requires WSL"),
    );
    assert.equal(formatAgentStartupError(new Error(once)), once);
  });
});
