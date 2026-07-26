import { checkApiAuth } from "~/lib/apiSecurity";
import { listModelCatalog } from "~/server/generatorFacade";
import {
  isServerProviderConfigured,
  readBrowserApiKey,
  readBrowserProvider,
  resolveProviderApiKey,
} from "~/server/aiProviderKey";
import { providerMeta } from "@widget-gen/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const authErr = checkApiAuth(request);
  if (authErr) return authErr;

  const provider = readBrowserProvider(request);
  const meta = providerMeta(provider);
  const browserKeyPresent = Boolean(readBrowserApiKey(request, provider));
  const effectiveKey = resolveProviderApiKey(request, provider);
  const catalog = await listModelCatalog(effectiveKey, provider);

  return Response.json({
    provider,
    providerLabel: meta.label,
    serverKeyConfigured: isServerProviderConfigured(provider),
    browserKeyAccepted: browserKeyPresent && Boolean(effectiveKey),
    ready: Boolean(effectiveKey),
    catalogSource: catalog.source,
    defaultModelId: catalog.defaultId,
    modelCount: catalog.models.length,
  });
}
