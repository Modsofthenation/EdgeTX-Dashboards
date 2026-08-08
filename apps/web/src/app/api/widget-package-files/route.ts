import { NextRequest } from "next/server";
import {
  isWidgetInstanceId,
  listWidgetSdFiles,
  sanitizeWidgetInstanceId,
  sanitizeWidgetName,
} from "~/server/generatorFacade";
import { checkApiAuth } from "~/lib/apiSecurity";

export const runtime = "nodejs";

function resolveKey(req: NextRequest): string | null {
  const workspaceKey = req.nextUrl.searchParams.get("workspaceKey");
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  const raw = workspaceKey ?? sessionId;
  if (!raw) return null;
  if (isWidgetInstanceId(raw)) return sanitizeWidgetInstanceId(raw);
  return sanitizeWidgetName(raw);
}

/** List package files mapped to SD paths for desktop install. */
export async function GET(req: NextRequest) {
  const authErr = checkApiAuth(req);
  if (authErr) return authErr;

  const key = resolveKey(req);
  if (!key) {
    return Response.json(
      { error: "workspaceKey or sessionId required" },
      { status: 400 },
    );
  }
  try {
    const files = listWidgetSdFiles(key);
    return Response.json({ files });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
