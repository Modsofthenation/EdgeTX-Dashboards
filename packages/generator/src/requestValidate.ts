import type { GenerateRequest, TelemetryProtocol } from "@widget-gen/shared";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getRepoRoot } from "./knowledge.js";

const PROTOCOLS: TelemetryProtocol[] = ["betaflight", "rotorflight", "generic-crsf"];

export const ALLOWED_MODEL_IDS = ["composer-2.5", "composer-2", "gpt-5.3-codex"] as const;
export type AllowedModelId = (typeof ALLOWED_MODEL_IDS)[number];

export function isAllowedModelId(value: string): value is AllowedModelId {
  return (ALLOWED_MODEL_IDS as readonly string[]).includes(value);
}

export function isTelemetryProtocol(value: string): value is TelemetryProtocol {
  return PROTOCOLS.includes(value as TelemetryProtocol);
}

export function validateGenerateRequest(body: Partial<GenerateRequest>): {
  ok: true;
  request: GenerateRequest;
} | {
  ok: false;
  error: string;
} {
  const prompt = body.prompt?.trim();
  if (!prompt) {
    return { ok: false, error: "prompt is required" };
  }
  if (prompt.length > 8000) {
    return { ok: false, error: "prompt exceeds maximum length (8000)" };
  }

  const radioId = body.radioId ?? "tx15";
  const radioPath = join(getRepoRoot(), "knowledge", "radios", `${radioId}.json`);
  if (!existsSync(radioPath)) {
    return { ok: false, error: `Unknown radio profile: ${radioId}` };
  }

  const protocol = body.protocol ?? "betaflight";
  if (!isTelemetryProtocol(protocol)) {
    return { ok: false, error: `Invalid protocol: ${protocol}` };
  }

  const modelId = body.modelId ?? "composer-2.5";
  if (!isAllowedModelId(modelId)) {
    return { ok: false, error: `Invalid model: ${modelId}` };
  }

  return {
    ok: true,
    request: {
      prompt,
      radioId,
      protocol,
      edgeTxVersion: body.edgeTxVersion,
      modelId,
    },
  };
}
