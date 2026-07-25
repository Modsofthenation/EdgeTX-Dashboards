import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  AI_API_KEY_LOCAL_STORAGE,
  AI_API_KEY_SESSION_STORAGE,
  AI_DEFAULT_MODEL_STORAGE,
  AI_REMEMBER_KEY_STORAGE,
  CURSOR_API_KEY_HEADER,
  clearStoredApiKey,
  persistApiKey,
  persistDefaultModelId,
  readStoredApiKey,
  readStoredDefaultModelId,
  withCursorApiKeyHeaders,
} from "./aiSettings.ts";

class MemoryStorage implements Storage {
  private data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.has(key) ? (this.data.get(key) as string) : null;
  }

  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }
}

describe("aiSettings storage", () => {
  const session = new MemoryStorage();
  const local = new MemoryStorage();

  afterEach(() => {
    session.clear();
    local.clear();
    // @ts-expect-error test shim
    globalThis.window = {
      sessionStorage: session,
      localStorage: local,
    };
    clearStoredApiKey();
    session.clear();
    local.clear();
  });

  it("stores session-only keys by default", () => {
    // @ts-expect-error test shim
    globalThis.window = {
      sessionStorage: session,
      localStorage: local,
    };

    persistApiKey("key_test_123", false);
    assert.equal(session.getItem(AI_API_KEY_SESSION_STORAGE), "key_test_123");
    assert.equal(local.getItem(AI_API_KEY_LOCAL_STORAGE), null);
    assert.deepEqual(readStoredApiKey(), {
      apiKey: "key_test_123",
      remember: false,
    });
  });

  it("stores remember keys in localStorage", () => {
    // @ts-expect-error test shim
    globalThis.window = {
      sessionStorage: session,
      localStorage: local,
    };

    persistApiKey("key_persist", true);
    assert.equal(local.getItem(AI_REMEMBER_KEY_STORAGE), "1");
    assert.equal(local.getItem(AI_API_KEY_LOCAL_STORAGE), "key_persist");
    assert.equal(session.getItem(AI_API_KEY_SESSION_STORAGE), null);
    assert.deepEqual(readStoredApiKey(), {
      apiKey: "key_persist",
      remember: true,
    });
  });

  it("persists preferred model id", () => {
    // @ts-expect-error test shim
    globalThis.window = {
      sessionStorage: session,
      localStorage: local,
    };

    persistDefaultModelId("composer-2.5");
    assert.equal(local.getItem(AI_DEFAULT_MODEL_STORAGE), "composer-2.5");
    assert.equal(readStoredDefaultModelId(), "composer-2.5");
  });

  it("adds the Cursor API key header when present", () => {
    const headers = withCursorApiKeyHeaders(
      { "Content-Type": "application/json" },
      "  key_abc  ",
    );
    assert.equal(headers.get("Content-Type"), "application/json");
    assert.equal(headers.get(CURSOR_API_KEY_HEADER), "key_abc");
  });

  it("omits the header when the key is empty", () => {
    const headers = withCursorApiKeyHeaders(undefined, "   ");
    assert.equal(headers.has(CURSOR_API_KEY_HEADER), false);
  });
});
