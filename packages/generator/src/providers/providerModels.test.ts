import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ANTHROPIC_MODELS,
  defaultModelForProvider,
  GEMINI_MODELS,
  isAllowedModelForProvider,
  listModelsForProvider,
  OPENAI_MODELS,
} from "./providerModels.ts";
import { validateGenerateRequest } from "../requestValidate.ts";

describe("providerModels", () => {
  it("loads the Anthropic model catalog from the API", async (t) => {
    t.mock.method(
      globalThis,
      "fetch",
      async (input: string | URL | Request, init?: RequestInit) => {
        assert.equal(
          String(input),
          "https://api.anthropic.com/v1/models?limit=1000",
        );
        const headers = new Headers(init?.headers);
        assert.equal(headers.get("x-api-key"), "anthropic-key");
        assert.equal(headers.get("anthropic-version"), "2023-06-01");
        assert.ok(init?.signal instanceof AbortSignal);
        return Response.json({
          data: [
            { id: "claude-sonnet-live", display_name: "Claude Sonnet Live" },
            { id: "claude-haiku-live", display_name: "Claude Haiku Live" },
          ],
        });
      },
    );

    const result = await listModelsForProvider("anthropic", "anthropic-key");

    assert.equal(result.source, "api");
    assert.equal(result.defaultId, "claude-sonnet-live");
    assert.deepEqual(result.models, [
      { id: "claude-sonnet-live", label: "Claude Sonnet Live" },
      { id: "claude-haiku-live", label: "Claude Haiku Live" },
    ]);
  });

  it("loads and orders chat-capable OpenAI models from the API", async (t) => {
    let fetchCalls = 0;
    t.mock.method(
      globalThis,
      "fetch",
      async (input: string | URL | Request, init?: RequestInit) => {
        fetchCalls += 1;
        assert.equal(String(input), "https://api.openai.com/v1/models");
        assert.equal(
          new Headers(init?.headers).get("authorization"),
          "Bearer openai-key",
        );
        assert.ok(init?.signal instanceof AbortSignal);
        return Response.json({
          data: [
            { id: "o4-mini" },
            { id: "gpt-5-live" },
            { id: "text-embedding-3-small" },
            { id: "gpt-4.1" },
            { id: "chatgpt-4o-latest" },
            { id: "o3-pro" },
          ],
        });
      },
    );

    const result = await listModelsForProvider("openai", "openai-key");

    assert.equal(result.source, "api");
    assert.equal(result.defaultId, "gpt-4.1");
    assert.deepEqual(
      result.models.map((model) => model.id),
      ["gpt-4.1", "o4-mini", "gpt-5-live", "chatgpt-4o-latest", "o3-pro"],
    );
    assert.equal(
      result.models.find((model) => model.id === "gpt-4.1")?.label,
      "GPT-4.1",
    );
    assert.deepEqual(
      await listModelsForProvider("openai", "openai-key"),
      result,
    );
    assert.equal(fetchCalls, 1);
  });

  it("returns the static Gemini catalog", async () => {
    const gemini = await listModelsForProvider("gemini");
    assert.equal(gemini.source, "fallback");
    assert.deepEqual(gemini.models, GEMINI_MODELS);
    assert.equal(gemini.defaultId, defaultModelForProvider("gemini"));
    assert.ok(gemini.models.some((m) => m.id === "gemini-3.5-flash"));
    assert.equal(
      gemini.models.some((m) => m.id === "gemini-2.0-flash"),
      false,
    );
  });

  it("falls back to static catalogs when provider APIs fail", async (t) => {
    t.mock.method(globalThis, "fetch", async () => {
      throw new Error("network unavailable");
    });

    const anthropic = await listModelsForProvider(
      "anthropic",
      "anthropic-fail-key",
    );
    assert.equal(anthropic.source, "fallback");
    assert.deepEqual(anthropic.models, ANTHROPIC_MODELS);

    const openai = await listModelsForProvider("openai", "openai-fail-key");
    assert.equal(openai.source, "fallback");
    assert.deepEqual(openai.models, OPENAI_MODELS);
  });

  it("falls back to static catalogs on non-ok provider responses", async (t) => {
    t.mock.method(
      globalThis,
      "fetch",
      async () => new Response(null, { status: 503 }),
    );

    const anthropic = await listModelsForProvider(
      "anthropic",
      "anthropic-non-ok-key",
    );
    assert.equal(anthropic.source, "fallback");
    assert.deepEqual(anthropic.models, ANTHROPIC_MODELS);

    const openai = await listModelsForProvider("openai", "openai-non-ok-key");
    assert.equal(openai.source, "fallback");
    assert.deepEqual(openai.models, OPENAI_MODELS);
  });

  it("falls back to static catalogs for empty provider data", async (t) => {
    t.mock.method(globalThis, "fetch", async () => Response.json({ data: [] }));

    const anthropic = await listModelsForProvider(
      "anthropic",
      "anthropic-empty-key",
    );
    assert.equal(anthropic.source, "fallback");
    assert.deepEqual(anthropic.models, ANTHROPIC_MODELS);

    const openai = await listModelsForProvider("openai", "openai-empty-key");
    assert.equal(openai.source, "fallback");
    assert.deepEqual(openai.models, OPENAI_MODELS);
  });

  it("validates model ids per provider", () => {
    assert.equal(
      isAllowedModelForProvider(
        "anthropic",
        defaultModelForProvider("anthropic"),
      ),
      true,
    );
    assert.equal(isAllowedModelForProvider("anthropic", "gpt-4.1"), false);
    assert.equal(isAllowedModelForProvider("openai", "gpt-4.1"), true);
    assert.equal(
      isAllowedModelForProvider("gemini", defaultModelForProvider("gemini")),
      true,
    );
    assert.equal(isAllowedModelForProvider("gemini", "gpt-4.1"), false);
  });
});

describe("validateGenerateRequest provider", () => {
  it("defaults provider to cursor and accepts anthropic models", () => {
    const cursor = validateGenerateRequest(
      { prompt: "battery row", radioId: "tx15", protocol: "betaflight" },
      { allowedModelIds: ["composer-2.5"] },
    );
    assert.equal(cursor.ok, true);
    if (cursor.ok) {
      assert.equal(cursor.request.provider, "cursor");
    }

    const anthropic = validateGenerateRequest(
      {
        prompt: "battery row",
        radioId: "tx15",
        protocol: "betaflight",
        provider: "anthropic",
        modelId: defaultModelForProvider("anthropic"),
      },
      { allowedModelIds: [defaultModelForProvider("anthropic")] },
    );
    assert.equal(anthropic.ok, true);
    if (anthropic.ok) {
      assert.equal(anthropic.request.provider, "anthropic");
      assert.equal(
        anthropic.request.modelId,
        defaultModelForProvider("anthropic"),
      );
    }

    const gemini = validateGenerateRequest(
      {
        prompt: "battery row",
        radioId: "tx15",
        protocol: "betaflight",
        provider: "gemini",
        modelId: defaultModelForProvider("gemini"),
      },
      { allowedModelIds: [defaultModelForProvider("gemini")] },
    );
    assert.equal(gemini.ok, true);
    if (gemini.ok) {
      assert.equal(gemini.request.provider, "gemini");
      assert.equal(gemini.request.modelId, defaultModelForProvider("gemini"));
    }
  });

  it("rejects mismatched model for provider allowlist", () => {
    const result = validateGenerateRequest(
      {
        prompt: "battery row",
        radioId: "tx15",
        protocol: "betaflight",
        provider: "openai",
        modelId: "composer-2.5",
      },
      { allowedModelIds: ["gpt-4.1"] },
    );
    assert.equal(result.ok, false);
  });
});
