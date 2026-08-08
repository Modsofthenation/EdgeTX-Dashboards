import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CURSOR_API_KEY_HEADER,
  getServerCursorApiKey,
  isServerCursorApiKeyConfigured,
  resolveCursorApiKey,
} from "../server/cursorApiKey.ts";

describe("resolveCursorApiKey", () => {
  it("prefers the browser header over the server env key", () => {
    const previous = process.env.CURSOR_API_KEY;
    process.env.CURSOR_API_KEY = "server_key";
    try {
      const request = new Request("http://localhost/api/ai/status", {
        headers: { [CURSOR_API_KEY_HEADER]: "browser_key" },
      });
      assert.equal(resolveCursorApiKey(request), "browser_key");
      assert.equal(getServerCursorApiKey(), "server_key");
      assert.equal(isServerCursorApiKeyConfigured(), true);
    } finally {
      if (previous === undefined) delete process.env.CURSOR_API_KEY;
      else process.env.CURSOR_API_KEY = previous;
    }
  });

  it("falls back to the server env key", () => {
    const previous = process.env.CURSOR_API_KEY;
    process.env.CURSOR_API_KEY = "server_only";
    try {
      const request = new Request("http://localhost/api/ai/status");
      assert.equal(resolveCursorApiKey(request), "server_only");
    } finally {
      if (previous === undefined) delete process.env.CURSOR_API_KEY;
      else process.env.CURSOR_API_KEY = previous;
    }
  });

  it("returns undefined when neither key is set", () => {
    const previous = process.env.CURSOR_API_KEY;
    delete process.env.CURSOR_API_KEY;
    try {
      const request = new Request("http://localhost/api/ai/status");
      assert.equal(resolveCursorApiKey(request), undefined);
      assert.equal(isServerCursorApiKeyConfigured(), false);
    } finally {
      if (previous === undefined) delete process.env.CURSOR_API_KEY;
      else process.env.CURSOR_API_KEY = previous;
    }
  });
});
