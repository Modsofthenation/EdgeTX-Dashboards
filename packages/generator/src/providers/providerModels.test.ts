import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultModelForProvider,
  isAllowedModelForProvider,
  listModelsForProvider,
} from "./providerModels.ts";
import { validateGenerateRequest } from "../requestValidate.ts";

describe("providerModels", () => {
  it("returns static Anthropic, OpenAI, and Gemini catalogs", async () => {
    const anthropic = await listModelsForProvider("anthropic");
    assert.ok(anthropic.models.length >= 1);
    assert.equal(anthropic.defaultId, defaultModelForProvider("anthropic"));
    assert.equal(anthropic.source, "fallback");

    const openai = await listModelsForProvider("openai");
    assert.ok(openai.models.length >= 1);
    assert.equal(openai.defaultId, defaultModelForProvider("openai"));

    const gemini = await listModelsForProvider("gemini");
    assert.ok(gemini.models.length >= 1);
    assert.equal(gemini.defaultId, defaultModelForProvider("gemini"));
    assert.equal(gemini.source, "fallback");
    assert.ok(gemini.models.some((m) => m.id === "gemini-3.5-flash"));
    assert.equal(
      gemini.models.some((m) => m.id === "gemini-2.0-flash"),
      false,
    );
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
