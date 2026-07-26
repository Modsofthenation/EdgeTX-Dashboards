import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isCursorSandboxEnabled } from "./cursorSandbox.ts";

describe("isCursorSandboxEnabled", () => {
  it("defaults to enabled", () => {
    assert.equal(isCursorSandboxEnabled({}), true);
    assert.equal(isCursorSandboxEnabled({ CURSOR_SANDBOX_ENABLED: "" }), true);
  });

  it("can be disabled explicitly", () => {
    assert.equal(isCursorSandboxEnabled({ CURSOR_SANDBOX_ENABLED: "0" }), false);
    assert.equal(
      isCursorSandboxEnabled({ CURSOR_SANDBOX_ENABLED: "false" }),
      false,
    );
  });
});
