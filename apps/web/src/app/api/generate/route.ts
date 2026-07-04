import { CursorAgentError, getSessionStore, validateGenerateRequest } from "@widget-gen/generator";
import { checkApiAuth, checkRateLimit, checkSessionCapacity } from "@/lib/apiSecurity";
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validated = validateGenerateRequest(body as Record<string, unknown>);
  if (!validated.ok) {
    return Response.json({ error: validated.error }, { status: 400 });
  }

  const store = getSessionStore();
  const capacityErr = checkSessionCapacity(store.activeCount);
  if (capacityErr) return capacityErr;

  const session = store.createSession(validated.request.radioId, validated.request.protocol);
  const stored = store.get(session.id)!;

  const stream = createSseStream(async (send) => {
    if (!store.tryAcquire(session.id)) {
      send({ type: "error", content: "Session busy", sessionId: session.id, success: false });
      return;
    }

    try {
      await stored.generator.createAgent();
      session.agentId = stored.generator.agentId ?? "";

      const ctx = { session, generator: stored.generator, send };
      const result = await stored.generator.generate(validated.request, createRunCallbacks(ctx));

      emitRunCompletion(ctx, result, { action: "generate" });
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
