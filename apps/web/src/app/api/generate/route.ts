import { CursorAgentError, getSessionStore, listModelCatalog, validateGenerateRequest } from "@/server/generatorFacade";
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

  const catalog = await listModelCatalog();
  const allowedModelIds = catalog.models.map((m) => m.id);
  const validated = validateGenerateRequest(body as Record<string, unknown>, { allowedModelIds });
  if (!validated.ok) {
    return Response.json({ error: validated.error }, { status: 400 });
  }

  const store = getSessionStore();
  const capacityErr = checkSessionCapacity(store.activeCount);
  if (capacityErr) return capacityErr;

  const session = store.createSession(
    validated.request.radioId,
    validated.request.protocol,
    validated.request.modelId
  );
  const stored = store.get(session.id)!;

  const stream = createSseStream(async (send) => {
    send({ type: "status", content: "Session ready", sessionId: session.id });

    if (!store.tryAcquire(session.id)) {
      send({ type: "error", content: "Session busy", sessionId: session.id, success: false });
      return;
    }

    try {
      await stored.generator.createAgent(validated.request.modelId);
      session.agentId = stored.generator.agentId ?? "";

      const ctx = { session, generator: stored.generator, send };
      const result = await stored.generator.generate(validated.request, createRunCallbacks(ctx), session);

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
