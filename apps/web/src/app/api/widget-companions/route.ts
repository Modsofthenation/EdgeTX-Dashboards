import { NextRequest } from "next/server";
import {
  isWidgetInstanceId,
  sanitizeWidgetInstanceId,
  sanitizeWidgetName,
  writeWidgetCompanionFiles,
} from "~/server/generatorFacade";

export const runtime = "nodejs";

function resolveKey(body: {
  workspaceKey?: string;
  sessionId?: string;
}): string | null {
  const raw = body.workspaceKey ?? body.sessionId;
  if (!raw) return null;
  if (isWidgetInstanceId(raw)) return sanitizeWidgetInstanceId(raw);
  return sanitizeWidgetName(raw);
}

/** Persist companion suite Lua under generated/<key>/ for zip + SD install. */
export async function POST(req: NextRequest) {
  let body: {
    workspaceKey?: string;
    sessionId?: string;
    files?: {
      relPath: string;
      content: string;
      encoding?: "utf8" | "base64";
    }[];
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const key = resolveKey(body);
  if (!key) {
    return Response.json(
      { error: "workspaceKey or sessionId required" },
      { status: 400 },
    );
  }
  if (!Array.isArray(body.files) || body.files.length === 0) {
    return Response.json({ error: "files required" }, { status: 400 });
  }
  try {
    const written = writeWidgetCompanionFiles(key, body.files);
    return Response.json({ ok: true, written });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
