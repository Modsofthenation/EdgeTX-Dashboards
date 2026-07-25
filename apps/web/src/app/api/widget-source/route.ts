import { checkApiAuth } from "~/lib/apiSecurity";
import {
  isTelemetryProtocol,
  readWidgetLuaSource,
  resolveWidgetWorkspaceFromSession,
  validateWidgetSource,
  writeWidgetLuaSource,
} from "~/server/generatorFacade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const authErr = checkApiAuth(request);
  if (authErr) return authErr;

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  const explicitName = searchParams.get("name");
  const explicitInstanceId = searchParams.get("instanceId");
  const versionParam = searchParams.get("version");
  const version =
    versionParam !== null && versionParam !== "" ? Number.parseInt(versionParam, 10) : undefined;

  const resolved = resolveWidgetWorkspaceFromSession(
    sessionId,
    explicitInstanceId,
    explicitName
  );
  if (resolved.pending) {
    return new Response(null, { status: 204 });
  }

  const widget = readWidgetLuaSource(
    resolved.workspaceKey,
    Number.isFinite(version) ? version : undefined
  );
  if (!widget) {
    return new Response(null, { status: 204 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "text/plain; charset=utf-8",
    "X-Widget-Name": widget.name,
    "X-Widget-Version": String(widget.version),
  };
  if (widget.instanceId) {
    headers["X-Widget-Instance-Id"] = widget.instanceId;
  }

  return new Response(widget.source, { headers });
}

export async function PUT(request: Request): Promise<Response> {
  const authErr = checkApiAuth(request);
  if (authErr) return authErr;

  let body: {
    source?: string;
    sessionId?: string;
    instanceId?: string;
    name?: string;
    protocol?: string;
    radioId?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const source = body.source?.trim();
  if (!source) {
    return Response.json({ error: "source is required" }, { status: 400 });
  }

  const resolved = resolveWidgetWorkspaceFromSession(
    body.sessionId ?? null,
    body.instanceId ?? null,
    body.name ?? null
  );
  if (resolved.pending || !resolved.workspaceKey) {
    return Response.json({ error: "Workspace not found" }, { status: 404 });
  }

  const protocol = body.protocol ?? "betaflight";
  if (!isTelemetryProtocol(protocol)) {
    return Response.json({ error: "Invalid protocol" }, { status: 400 });
  }

  const radioId = body.radioId ?? "tx15";
  const validation = validateWidgetSource(source, protocol, { radioId, strictTelemetry: true });

  if (!validation.valid) {
    return Response.json(
      { valid: false, issues: validation.issues, error: "Validation failed" },
      { status: 422 }
    );
  }

  writeWidgetLuaSource(resolved.workspaceKey, source);

  return Response.json({
    valid: true,
    issues: validation.issues,
    workspaceKey: resolved.workspaceKey,
  });
}
