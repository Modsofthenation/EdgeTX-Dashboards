import { checkApiAuth } from "@/lib/apiSecurity";
import {
  DEFAULT_MODEL_ID,
  FALLBACK_MODELS,
  getDefaultModelId,
  listAvailableModels,
} from "@widget-gen/generator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const authErr = checkApiAuth(request);
  if (authErr) return authErr;

  if (!process.env.CURSOR_API_KEY) {
    return Response.json({
      defaultId: DEFAULT_MODEL_ID,
      models: FALLBACK_MODELS,
      source: "fallback",
    });
  }

  const models = await listAvailableModels();
  const usingFallback =
    models.length === FALLBACK_MODELS.length &&
    models.every((model, index) => model.id === FALLBACK_MODELS[index]?.id);

  return Response.json({
    defaultId: getDefaultModelId(models),
    models,
    source: usingFallback ? "fallback" : "api",
  });
}
