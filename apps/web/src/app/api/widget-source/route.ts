import { checkApiAuth } from "@/lib/apiSecurity";
import { readWidgetLuaSource, resolveWidgetNameFromSession, sanitizeWidgetName } from "@/server/generatorFacade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const authErr = checkApiAuth(request);
  if (authErr) return authErr;

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  const explicitName = searchParams.get("name");

  const resolved = resolveWidgetNameFromSession(sessionId, explicitName);
  if (resolved.pending) {
    return new Response(null, { status: 204 });
  }

  let safeName: string;
  try {
    safeName = sanitizeWidgetName(resolved.name!);
  } catch {
    return Response.json({ error: "Invalid widget name" }, { status: 400 });
  }

  const widget = readWidgetLuaSource(safeName);
  if (!widget) {
    return new Response(null, { status: 204 });
  }

  return new Response(widget.source, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Widget-Name": widget.name,
    },
  });
}
