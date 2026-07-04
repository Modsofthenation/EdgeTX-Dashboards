import { CursorAgentError, getSessionStore } from "@widget-gen/generator";
import type { RefineRequest } from "@widget-gen/shared";
import { checkApiAuth, checkRateLimit } from "@/lib/apiSecurity";
import { createSseResponse, createSseStream } from "@/lib/sse";
import { createRunCallbacks, emitRunCompletion } from "@/lib/widgetSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const authErr = checkApiAuth(request);
  if (authErr) return authErr;

  const rateErr = checkRateLimit(request);
  if (rateErr) return rateErr;

  if (!process.env.CURSOR_API_KEY) {
    return Response.json({ error: "CURSOR_API_KEY is not configured on the server" }, { status: 500 });
  }

  let body: RefineRequest;
  try {
    body = (await request.json()) as RefineRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.sessionId || !body.prompt?.trim()) {
    return Response.json({ error: "sessionId and prompt are required" }, { status: 400 });
  }

  const store = getSessionStore();
  const stored = store.tryAcquire(body.sessionId);
  if (!stored) {
    const exists = store.get(body.sessionId);
    if (!exists) {
      return Response.json({ error: "Session not found or expired" }, { status: 404 });
    }
    return Response.json({ error: "Session is busy with another run" }, { status: 409 });
  }

  const { session, generator } = stored;

  const stream = createSseStream(async (send) => {
    try {
      const ctx = { session, generator, send };
      const result = await generator.refine(
        body.prompt,
        session.protocol,
        session.radioId,
        session.widgetName,
        createRunCallbacks(ctx)
      );

      emitRunCompletion(ctx, result, { action: "refine" });
    } catch (err) {
      const message =
        err instanceof CursorAgentError
          ? `Startup failed: ${err.message}`
          : err instanceof Error
            ? err.message
            : "Unknown error";
      send({ type: "error", content: message, sessionId: session.id, success: false });
    } finally {
      store.release(session.id);
    }
  });

  return createSseResponse(stream);
}
