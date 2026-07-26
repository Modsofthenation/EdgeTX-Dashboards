import type { TelemetryProtocol } from "@widget-gen/shared";
import { buildInstallGuide } from "~/lib/installGuide";

import { checkApiAuth } from "~/lib/apiSecurity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const authErr = checkApiAuth(request);
  if (authErr) return authErr;

  const { searchParams } = new URL(request.url);
  const protocol = (searchParams.get("protocol") ??
    "betaflight") as TelemetryProtocol;
  const widgetName = searchParams.get("widget") ?? undefined;
  const radioName = searchParams.get("radioName") ?? undefined;
  const lcdWRaw = searchParams.get("lcdW");
  const lcdHRaw = searchParams.get("lcdH");
  const touchRaw = searchParams.get("touch");

  const valid: TelemetryProtocol[] = [
    "betaflight",
    "rotorflight",
    "generic-crsf",
  ];
  if (!valid.includes(protocol)) {
    return Response.json({ error: "Invalid protocol" }, { status: 400 });
  }

  return Response.json(
    buildInstallGuide(protocol, widgetName ?? undefined, {
      radioName,
      lcdW: lcdWRaw ? Number(lcdWRaw) : undefined,
      lcdH: lcdHRaw ? Number(lcdHRaw) : undefined,
      touch:
        touchRaw === null ? undefined : touchRaw === "1" || touchRaw === "true",
    }),
  );
}
