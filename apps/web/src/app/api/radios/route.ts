import { checkApiAuth } from "@/lib/apiSecurity";
import { getLayoutProfileId, listRadioProfiles } from "@widget-gen/generator";
import { DEFAULT_RADIO_ID } from "@widget-gen/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const authErr = checkApiAuth(request);
  if (authErr) return authErr;

  const radios = listRadioProfiles().map((radio) => ({
    id: radio.id,
    name: radio.name,
    lcdW: radio.lcdW,
    lcdH: radio.lcdH,
    touch: radio.touch,
    layoutProfile: getLayoutProfileId(radio),
    default: radio.id === DEFAULT_RADIO_ID,
  }));

  return Response.json({ defaultId: DEFAULT_RADIO_ID, radios });
}
