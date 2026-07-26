import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  getServerApiKey,
  readBrowserProvider,
  resolveProviderApiKey,
} from "./aiProviderKey.ts";

describe("aiProviderKey", () => {
  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  it("reads provider from x-ai-provider header", () => {
    const request = new Request("http://localhost/api/models", {
      headers: { "x-ai-provider": "anthropic" },
    });
    assert.equal(readBrowserProvider(request), "anthropic");
  });

  it("defaults unknown providers to cursor", () => {
    const request = new Request("http://localhost/api/models", {
      headers: { "x-ai-provider": "nope" },
    });
    assert.equal(readBrowserProvider(request), "cursor");
  });

  it("prefers browser key over server env for the selected provider", () => {
    process.env.ANTHROPIC_API_KEY = "server_ant";
    const request = new Request("http://localhost/api/generate", {
      headers: {
        "x-ai-provider": "anthropic",
        "x-anthropic-api-key": "browser_ant",
      },
    });
    assert.equal(resolveProviderApiKey(request, "anthropic"), "browser_ant");
    assert.equal(getServerApiKey("anthropic"), "server_ant");
  });

  it("falls back to server OpenAI key", () => {
    process.env.OPENAI_API_KEY = "server_oai";
    const request = new Request("http://localhost/api/generate", {
      headers: { "x-ai-provider": "openai" },
    });
    assert.equal(resolveProviderApiKey(request, "openai"), "server_oai");
  });
});
