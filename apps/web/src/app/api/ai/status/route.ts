import { checkApiAuth } from "~/lib/apiSecurity";
import { listModelCatalog } from "~/server/generatorFacade";
import {
  isServerCursorApiKeyConfigured,
  resolveCursorApiKey,
} from "~/server/cursorApiKey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const authErr = checkApiAuth(request);
  if (authErr) return authErr;

  const browserKeyPresent = Boolean(
    request.headers.get("x-cursor-api-key")?.trim(),
  );
  const effectiveKey = resolveCursorApiKey(request);
  const catalog = await listModelCatalog(effectiveKey);

  return Response.json({
    serverKeyConfigured: isServerCursorApiKeyConfigured(),
    browserKeyAccepted: browserKeyPresent && Boolean(effectiveKey),
    ready: Boolean(effectiveKey),
    catalogSource: catalog.source,
    defaultModelId: catalog.defaultId,
    modelCount: catalog.models.length,
  });
}
