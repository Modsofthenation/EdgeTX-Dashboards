import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizeGeminiParameters } from "./toolLoopAgent.ts";

describe("sanitizeGeminiParameters", () => {
  it("strips default keys recursively while preserving other fields", () => {
    const cleaned = sanitizeGeminiParameters({
      type: "object",
      properties: {
        radioId: { type: "string", default: "tx15" },
        protocol: {
          type: "string",
          enum: ["betaflight", "rotorflight", "generic-crsf"],
        },
        nested: {
          type: "object",
          properties: {
            flag: { type: "boolean", default: true },
          },
        },
      },
      required: ["protocol"],
    });

    assert.deepEqual(cleaned, {
      type: "object",
      properties: {
        radioId: { type: "string" },
        protocol: {
          type: "string",
          enum: ["betaflight", "rotorflight", "generic-crsf"],
        },
        nested: {
          type: "object",
          properties: {
            flag: { type: "boolean" },
          },
        },
      },
      required: ["protocol"],
    });
  });
});
