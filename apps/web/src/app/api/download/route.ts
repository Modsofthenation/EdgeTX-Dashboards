import { checkApiAuth } from "@/lib/apiSecurity";
import {
  findLatestWidgetName,
  getSessionStore,
  isTelemetryProtocol,
  readOrBuildWidgetZip,
  sanitizeWidgetName,
  validateWidgetRelease,
  WidgetValidationError,
} from "@/server/generatorFacade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const authErr = checkApiAuth(request);
  if (authErr) return authErr;

  const { searchParams } = new URL(request.url);
  let name = searchParams.get("name");
  const sessionId = searchParams.get("sessionId");
  let protocol = searchParams.get("protocol");
  let radioId = searchParams.get("radioId") ?? "tx15";

  if (sessionId) {
    const stored = getSessionStore().get(sessionId);
    if (!stored) {
      return Response.json({ error: "Session not found or expired" }, { status: 404 });
    }
    if (!stored.session.validated) {
      return Response.json(
        {
          error: "Widget has not passed validation",
          validationIssues: stored.session.validationIssues ?? [],
        },
        { status: 422 }
      );
    }
    if (stored.session.widgetName) {
      name = stored.session.widgetName;
    } else {
      const latest = findLatestWidgetName();
      if (latest) {
        stored.session.widgetName = latest;
        name = latest;
      }
    }
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

  const validation = validateWidgetRelease(safeName, protocol, radioId);
  if (!validation.valid) {
    return Response.json({ error: "Widget failed validation", validation }, { status: 422 });
  }

  try {
    const buffer = await readOrBuildWidgetZip(safeName, protocol, radioId);
    if (!buffer) {
      return Response.json({ error: "Widget zip not found" }, { status: 404 });
    }

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeName}.zip"`,
      },
    });
  } catch (err) {
    if (err instanceof WidgetValidationError) {
      return Response.json({ error: err.message, validation: err.result }, { status: 422 });
    }
    return Response.json({ error: "Widget zip not found" }, { status: 404 });
  }
}
