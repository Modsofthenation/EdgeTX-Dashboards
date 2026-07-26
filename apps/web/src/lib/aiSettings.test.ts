import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  AI_API_KEY_LOCAL_STORAGE,
  AI_API_KEY_SESSION_STORAGE,
  AI_DEFAULT_MODEL_STORAGE,
  AI_PROVIDER_HEADER,
  AI_PROVIDER_STORAGE,
  AI_REMEMBER_KEY_STORAGE,
  CURSOR_API_KEY_HEADER,
  clearStoredApiKey,
  persistApiKey,
  persistDefaultModelId,
  persistProvider,
  readStoredApiKey,
  readStoredDefaultModelId,
  readStoredProvider,
  withCursorApiKeyHeaders,
  withProviderAuthHeaders,
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
    clearStoredApiKey("cursor");
    clearStoredApiKey("anthropic");
    clearStoredApiKey("openai");
    session.clear();
    local.clear();
  });

  it("stores session-only keys by default", () => {
    // @ts-expect-error test shim
    globalThis.window = {
      sessionStorage: session,
      localStorage: local,
    };

    persistApiKey("key_test_123", false, "cursor");
    assert.equal(session.getItem(AI_API_KEY_SESSION_STORAGE), "key_test_123");
    assert.equal(local.getItem(AI_API_KEY_LOCAL_STORAGE), null);
    assert.deepEqual(readStoredApiKey("cursor"), {
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

    persistApiKey("key_persist", true, "cursor");
    assert.equal(local.getItem(AI_REMEMBER_KEY_STORAGE), "1");
    assert.equal(local.getItem(AI_API_KEY_LOCAL_STORAGE), "key_persist");
    assert.equal(session.getItem(AI_API_KEY_SESSION_STORAGE), null);
    assert.deepEqual(readStoredApiKey("cursor"), {
      apiKey: "key_persist",
      remember: true,
    });
  });

  it("keeps per-provider keys separate", () => {
    // @ts-expect-error test shim
    globalThis.window = {
      sessionStorage: session,
      localStorage: local,
    };

    persistApiKey("cursor_key", false, "cursor");
    persistApiKey("sk-ant-test", false, "anthropic");
    assert.equal(readStoredApiKey("cursor").apiKey, "cursor_key");
    assert.equal(readStoredApiKey("anthropic").apiKey, "sk-ant-test");
    assert.equal(
      session.getItem("widget-gen.ai.apiKey.anthropic.session"),
      "sk-ant-test",
    );
  });

  it("persists preferred provider and model id", () => {
    // @ts-expect-error test shim
    globalThis.window = {
      sessionStorage: session,
      localStorage: local,
    };

    persistProvider("openai");
    assert.equal(local.getItem(AI_PROVIDER_STORAGE), "openai");
    assert.equal(readStoredProvider(), "openai");

    persistDefaultModelId("gpt-4.1", "openai");
    assert.equal(readStoredDefaultModelId("openai"), "gpt-4.1");
    persistDefaultModelId("composer-2.5", "cursor");
    assert.equal(local.getItem(AI_DEFAULT_MODEL_STORAGE), "composer-2.5");
  });

  it("adds the Cursor API key header when present", () => {
    const headers = withCursorApiKeyHeaders(
      { "Content-Type": "application/json" },
      "  key_abc  ",
    );
    assert.equal(headers.get("Content-Type"), "application/json");
    assert.equal(headers.get(CURSOR_API_KEY_HEADER), "key_abc");
    assert.equal(headers.get(AI_PROVIDER_HEADER), "cursor");
  });

  it("adds provider + OpenAI headers together", () => {
    const headers = withProviderAuthHeaders(undefined, "openai", "sk-test");
    assert.equal(headers.get(AI_PROVIDER_HEADER), "openai");
    assert.equal(headers.get("x-openai-api-key"), "sk-test");
  });

  it("omits the key header when empty but still sets provider", () => {
    const headers = withProviderAuthHeaders(undefined, "anthropic", "   ");
    assert.equal(headers.get(AI_PROVIDER_HEADER), "anthropic");
    assert.equal(headers.has("x-anthropic-api-key"), false);
  });
});
