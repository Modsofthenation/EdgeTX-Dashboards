import { readFileSync, existsSync } from "node:fs";
import {
  getWidgetLuaPath,
  getSessionStore,
  sanitizeWidgetName,
  findLatestWidgetName,
} from "@widget-gen/generator";
import { checkApiAuth } from "@/lib/apiSecurity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveWidgetName(
  sessionId: string | null,
  explicitName: string | null
): { name?: string; pending?: boolean; error?: Response } {
  let name = explicitName?.trim() || undefined;

  if (sessionId) {
    const stored = getSessionStore().get(sessionId);
    if (stored) {
      name = name ?? stored.session.widgetName ?? undefined;
      if (!name) {
        const latest = findLatestWidgetName();
        if (latest) {
          stored.session.widgetName = latest;
          name = latest;
        }
      }
    }
  }

  if (!name) {
    return { pending: true };
  }

  return { name };
}

export async function GET(request: Request): Promise<Response> {
  const authErr = checkApiAuth(request);
  if (authErr) return authErr;

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  const explicitName = searchParams.get("name");

  const resolved = resolveWidgetName(sessionId, explicitName);
  if (resolved.error) return resolved.error;
  if (resolved.pending) {
    return new Response(null, { status: 204 });
  }

  let safeName: string;
  try {
    safeName = sanitizeWidgetName(resolved.name!);
  } catch {
    return Response.json({ error: "Invalid widget name" }, { status: 400 });
  }

  const path = getWidgetLuaPath(safeName);
  if (!existsSync(path)) {
    return new Response(null, { status: 204 });
  }

  const source = readFileSync(path, "utf-8");
  return new Response(source, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Widget-Name": safeName,
    },
  });
}
