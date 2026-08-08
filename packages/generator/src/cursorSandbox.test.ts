import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isCursorSandboxEnabled } from "./cursorSandbox.ts";

describe("isCursorSandboxEnabled", () => {
  it("defaults to enabled for normal web/dev", () => {
    assert.equal(isCursorSandboxEnabled({}), true);
    assert.equal(isCursorSandboxEnabled({ CURSOR_SANDBOX_ENABLED: "" }), true);
  });

  it("does not infer desktop from WIDGET_GEN_REPO_ROOT alone", () => {
    assert.equal(
      isCursorSandboxEnabled({ WIDGET_GEN_REPO_ROOT: "/app/data/workspace" }),
      true,
    );
  });

  it("can be disabled explicitly", () => {
    assert.equal(
      isCursorSandboxEnabled({ CURSOR_SANDBOX_ENABLED: "0" }),
      false,
    );
    assert.equal(
      isCursorSandboxEnabled({ CURSOR_SANDBOX_ENABLED: "false" }),
      false,
    );
  });

  it("explicit enable wins even when repo root is set", () => {
    assert.equal(
      isCursorSandboxEnabled({
        WIDGET_GEN_REPO_ROOT: "/app/data/workspace",
        CURSOR_SANDBOX_ENABLED: "1",
      }),
      true,
    );
  });
});
