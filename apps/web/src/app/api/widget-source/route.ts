import { readFileSync, existsSync } from "node:fs";
import { getWidgetLuaPath, getSessionStore, sanitizeWidgetName } from "@widget-gen/generator";
import { checkApiAuth } from "@/lib/apiSecurity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const authErr = checkApiAuth(request);
  if (authErr) return authErr;

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  let name = searchParams.get("name");

  if (sessionId) {
    const stored = getSessionStore().get(sessionId);
    if (!stored) {
      return Response.json({ error: "Session not found or expired" }, { status: 404 });
    }
    if (stored.session.widgetName) {
      name = stored.session.widgetName;
    } else {
      return Response.json({ error: "No widget generated for this session yet" }, { status: 404 });
    }
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

  const path = getWidgetLuaPath(safeName);
  if (!existsSync(path)) {
    return Response.json({ error: "Widget source not found" }, { status: 404 });
  }

  const source = readFileSync(path, "utf-8");
  return new Response(source, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Widget-Name": safeName,
    },
  });
}
