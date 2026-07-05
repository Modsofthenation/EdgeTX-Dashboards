import { checkApiAuth } from "@/lib/apiSecurity";
import {
  getSessionStore,
  isTelemetryProtocol,
  readOrBuildWidgetZip,
  resolveWidgetWorkspaceFromSession,
  sanitizeWidgetInstanceId,
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
  let workspaceKey = searchParams.get("instanceId") ?? searchParams.get("name");
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
    workspaceKey = stored.session.widgetInstanceId ?? stored.session.widgetName ?? workspaceKey;
    protocol = stored.session.protocol;
    radioId = stored.session.radioId;
  }

  if (!workspaceKey) {
    const resolved = resolveWidgetWorkspaceFromSession(sessionId, null, null);
    if (!resolved.pending) workspaceKey = resolved.workspaceKey;
  }

  if (!workspaceKey) {
    return Response.json({ error: "instanceId, name, or sessionId is required" }, { status: 400 });
  }

  let safeKey: string;
  try {
    safeKey = sanitizeWidgetInstanceId(workspaceKey);
  } catch {
    try {
      safeKey = sanitizeWidgetName(workspaceKey);
    } catch {
      return Response.json({ error: "Invalid widget workspace key" }, { status: 400 });
    }
  }

  if (!protocol || !isTelemetryProtocol(protocol)) {
    return Response.json({ error: "Invalid or missing protocol" }, { status: 400 });
  }

  const validation = validateWidgetRelease(safeKey, protocol, radioId);
  if (!validation.valid) {
    return Response.json({ error: "Widget failed validation", validation }, { status: 422 });
  }

  try {
    const zip = await readOrBuildWidgetZip(safeKey, protocol, radioId);
    if (!zip) {
      return Response.json({ error: "Widget zip not found" }, { status: 404 });
    }

    return new Response(new Uint8Array(zip.buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zip.downloadName}.zip"`,
      },
    });
  } catch (err) {
    if (err instanceof WidgetValidationError) {
      return Response.json({ error: err.message, validation: err.result }, { status: 422 });
    }
    return Response.json({ error: "Widget zip not found" }, { status: 404 });
  }
}
