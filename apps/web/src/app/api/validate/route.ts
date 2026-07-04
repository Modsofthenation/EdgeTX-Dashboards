import {
  validateWidgetForRelease,
  getSessionStore,
  isTelemetryProtocol,
  sanitizeWidgetName,
} from "@widget-gen/generator";
import { checkApiAuth } from "@/lib/apiSecurity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const authErr = checkApiAuth(request);
  if (authErr) return authErr;

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  let name = searchParams.get("name");
  let protocol = searchParams.get("protocol");
  let radioId = searchParams.get("radioId") ?? "tx15";

  if (sessionId) {
    const stored = getSessionStore().get(sessionId);
    if (!stored) {
      return Response.json({ error: "Session not found or expired" }, { status: 404 });
    }
    if (stored.session.widgetName) name = stored.session.widgetName;
    protocol = stored.session.protocol;
    radioId = stored.session.radioId;
  }

  if (!name) {
    return Response.json({ error: "name or sessionId is required" }, { status: 400 });
  }

  let safeName: string;
  try {
    safeName = sanitizeWidgetName(name);
  } catch {
    return Response.json({ error: "Invalid widget name" }, { status: 400 });
  }

  if (!protocol || !isTelemetryProtocol(protocol)) {
    return Response.json({ error: "Invalid or missing protocol" }, { status: 400 });
  }

  const result = validateWidgetForRelease(safeName, protocol, { radioId, strictTelemetry: true });
  return Response.json(result);
}
