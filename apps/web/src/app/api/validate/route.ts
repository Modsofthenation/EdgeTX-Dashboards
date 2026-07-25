import { checkApiAuth } from "~/lib/apiSecurity";
import {
  getSessionStore,
  isTelemetryProtocol,
  sanitizeWidgetName,
  validateWidgetRelease,
  validateWidgetSource,
} from "~/server/generatorFacade";

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

  const result = validateWidgetRelease(safeName, protocol, radioId);
  return Response.json(result);
}

export async function POST(request: Request): Promise<Response> {
  const authErr = checkApiAuth(request);
  if (authErr) return authErr;

  let body: { source?: string; protocol?: string; radioId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const source = body.source?.trim();
  if (!source) {
    return Response.json({ error: "source is required" }, { status: 400 });
  }

  const protocol = body.protocol ?? "betaflight";
  if (!isTelemetryProtocol(protocol)) {
    return Response.json({ error: "Invalid protocol" }, { status: 400 });
  }

  const radioId = body.radioId ?? "tx15";
  const result = validateWidgetSource(source, protocol, { radioId, strictTelemetry: true });
  return Response.json(result);
}
