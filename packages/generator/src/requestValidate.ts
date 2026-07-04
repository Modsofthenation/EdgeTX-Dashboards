import type { GenerateRequest, TelemetryProtocol } from "@widget-gen/shared";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getRepoRoot } from "./knowledge.js";
import { DEFAULT_MODEL_ID, isAllowedModelId } from "./models.js";

const PROTOCOLS: TelemetryProtocol[] = ["betaflight", "rotorflight", "generic-crsf"];

export { DEFAULT_MODEL_ID as DEFAULT_CHAT_MODEL_ID } from "./models.js";
export { FALLBACK_MODELS as ALLOWED_MODEL_IDS } from "./models.js";

export function isTelemetryProtocol(value: string): value is TelemetryProtocol {
  return PROTOCOLS.includes(value as TelemetryProtocol);
}

export function validateGenerateRequest(
  body: Partial<GenerateRequest>,
  options?: { allowedModelIds?: string[] }
): {
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

  const modelId = body.modelId ?? DEFAULT_MODEL_ID;
  if (!isAllowedModelId(modelId, options?.allowedModelIds)) {
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
