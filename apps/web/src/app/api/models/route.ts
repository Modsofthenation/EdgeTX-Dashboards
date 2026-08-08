import { checkApiAuth } from "~/lib/apiSecurity";
import { listModelCatalog } from "~/server/generatorFacade";
import {
  readBrowserProvider,
  resolveProviderApiKey,
} from "~/server/aiProviderKey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const authErr = checkApiAuth(request);
  if (authErr) return authErr;

  const provider = readBrowserProvider(request);
  const apiKey = resolveProviderApiKey(request, provider);
  const catalog = await listModelCatalog(apiKey, provider);
  return Response.json(
    { ...catalog, provider },
    {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=30",
      },
    },
  );
}
