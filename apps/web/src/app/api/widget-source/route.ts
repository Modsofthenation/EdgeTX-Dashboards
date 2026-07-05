import { checkApiAuth } from "@/lib/apiSecurity";
import { readWidgetLuaSource, resolveWidgetWorkspaceFromSession } from "@/server/generatorFacade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const authErr = checkApiAuth(request);
  if (authErr) return authErr;

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  const explicitName = searchParams.get("name");
  const explicitInstanceId = searchParams.get("instanceId");

  const resolved = resolveWidgetWorkspaceFromSession(
    sessionId,
    explicitInstanceId,
    explicitName
  );
  if (resolved.pending) {
    return new Response(null, { status: 204 });
  }

  const widget = readWidgetLuaSource(resolved.workspaceKey);
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
