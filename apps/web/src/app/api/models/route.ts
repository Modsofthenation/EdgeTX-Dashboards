import { checkApiAuth } from "~/lib/apiSecurity";
import { listModelCatalog } from "~/server/generatorFacade";
import { resolveCursorApiKey } from "~/server/cursorApiKey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const authErr = checkApiAuth(request);
  if (authErr) return authErr;

  const apiKey = resolveCursorApiKey(request);
  const catalog = await listModelCatalog(apiKey);
  return Response.json(catalog, {
    headers: {
      "Cache-Control": "private, max-age=60, stale-while-revalidate=30",
    },
  });
}
