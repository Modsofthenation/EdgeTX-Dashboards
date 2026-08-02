import {
  CursorAgentError,
  getSessionStore,
  listModelCatalog,
  validateGenerateRequest,
} from "~/server/generatorFacade";
import { resolveProviderApiKey } from "~/server/aiProviderKey";
import { parseAiProviderId, providerMeta } from "@widget-gen/shared";
import {
  checkApiAuth,
  checkRateLimit,
  checkSessionCapacity,
} from "~/lib/apiSecurity";
import { createSseResponse, createSseStream } from "~/lib/sse";
import { createRunCallbacks, emitRunCompletion } from "~/lib/widgetSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const authErr = checkApiAuth(request);
  if (authErr) return authErr;

  const rateErr = checkRateLimit(request);
  if (rateErr) return rateErr;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const bodyProvider =
    body && typeof body === "object" && "provider" in body
      ? (body as { provider?: unknown }).provider
      : undefined;
  const provider = parseAiProviderId(
    request.headers.get("x-ai-provider") ?? bodyProvider,
  );

  const apiKey = resolveProviderApiKey(request, provider);
  if (!apiKey) {
    const meta = providerMeta(provider);
    return Response.json(
      {
        error: `No ${meta.label} API key configured. Add one in Settings → AI, or set ${meta.envVar} on the server.`,
      },
      { status: 503 },
    );
  }

  let validated: ReturnType<typeof validateGenerateRequest>;
  try {
    const catalog = await listModelCatalog(apiKey, provider);
    const allowedModelIds = catalog.models.map((m) => m.id);
    validated = validateGenerateRequest(
      {
        ...(body as Record<string, unknown>),
        provider,
      },
      { allowedModelIds },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/generate] startup failed:", message);
    return Response.json(
      {
        error: message.includes("repository root")
          ? "Desktop package is missing generator assets (knowledge/). Reinstall from a fresh desktop build, or run from the repo with npm run desktop:dev."
          : message,
      },
      { status: 500 },
    );
  }
  if (!validated.ok) {
    return Response.json({ error: validated.error }, { status: 400 });
  }

  let session;
  let stored;
  try {
    const store = getSessionStore();
    const capacityErr = checkSessionCapacity(store.activeCount);
    if (capacityErr) return capacityErr;

    session = store.createSession(
      validated.request.radioId,
      validated.request.protocol,
      validated.request.modelId,
      apiKey,
      validated.request.provider ?? provider,
    );
    stored = store.get(session.id)!;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/generate] session create failed:", message);
    return Response.json(
      {
        error: message.includes("repository root")
          ? "Desktop package is missing generator assets (knowledge/). Reinstall from a fresh desktop build."
          : message,
      },
      { status: 500 },
    );
  }

  const store = getSessionStore();

  const stream = createSseStream(
    async (send) => {
      send({ type: "status", content: "Session ready", sessionId: session.id });

      if (!store.tryAcquire(session.id)) {
        send({
          type: "error",
          content: "Session busy",
          sessionId: session.id,
          success: false,
        });
        return;
      }

      try {
        await stored.generator.createAgent(validated.request.modelId);
        session.agentId = stored.generator.agentId ?? "";

        const ctx = { session, generator: stored.generator, send };
        const result = await stored.generator.generate(
          validated.request,
          createRunCallbacks(ctx),
          session,
          { signal: request.signal },
        );

        emitRunCompletion(ctx, result, { action: "generate" });
      } catch (err) {
        if (request.signal.aborted) {
          return;
        }
        const message =
          err instanceof CursorAgentError
            ? `Startup failed: ${err.message}`
            : err instanceof Error
              ? err.message
              : "Unknown error";
        send({
          type: "error",
          content: message,
          sessionId: session.id,
          success: false,
        });
      } finally {
        store.release(session.id);
      }
    },
    { signal: request.signal },
  );

  return createSseResponse(stream);
}
