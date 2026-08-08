import { checkApiAuth } from "~/lib/apiSecurity";
import { listRadioCatalog } from "~/server/generatorFacade";
import { DEFAULT_RADIO_ID } from "@widget-gen/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const authErr = checkApiAuth(request);
  if (authErr) return authErr;

  const radios = listRadioCatalog().map((radio) => ({
    ...radio,
    default: radio.id === DEFAULT_RADIO_ID,
  }));

  return Response.json({ defaultId: DEFAULT_RADIO_ID, radios });
}
