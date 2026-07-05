import { CursorAgentError, getSessionStore, writeWidgetLuaSource } from "@/server/generatorFacade";
import { checkApiAuth } from "@/lib/apiSecurity";
import { getChat } from "@/lib/db/chatStore";
import { createSseResponse, createSseStream } from "@/lib/sse";
import { createRunCallbacks, emitRunCompletion } from "@/lib/widgetSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveRefineSession(sessionId: string, chatId?: string) {
  const store = getSessionStore();
  let effectiveSessionId = sessionId;
  let stored = store.get(sessionId);

  if (!stored && chatId) {
    const chat = getChat(chatId);
    if (chat?.widgetName) {
      if (chat.artifact?.luaSource) {
        writeWidgetLuaSource(chat.widgetName, chat.artifact.luaSource);
      }
      const restored = store.restoreSession({
        id: chat.sessionId ?? sessionId,
        radioId: chat.radioId,
        protocol: chat.protocol,
        modelId: chat.modelId,
        widgetName: chat.widgetName,
      });
      effectiveSessionId = restored.id;
      stored = store.get(restored.id);
    }
  }

  return { store, stored, sessionId: effectiveSessionId };
}

export async function POST(request: Request): Promise<Response> {
  const authErr = checkApiAuth(request);
  if (authErr) return authErr;

  if (!process.env.CURSOR_API_KEY) {
    return Response.json({ error: "CURSOR_API_KEY is not configured on the server" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data = body as { sessionId?: string; chatId?: string; prompt?: string };
  if (!data.sessionId?.trim() || !data.prompt?.trim()) {
    return Response.json({ error: "sessionId and prompt are required" }, { status: 400 });
  }

  const { store, stored, sessionId: effectiveSessionId } = resolveRefineSession(
    data.sessionId,
    data.chatId?.trim()
  );
  if (!stored) {
    return Response.json({ error: "Session not found or expired" }, { status: 404 });
  }

  const stream = createSseStream(async (send) => {
    if (!store.tryAcquire(effectiveSessionId)) {
      send({ type: "error", content: "Session busy", sessionId: effectiveSessionId, success: false });
      return;
    }

    try {
      const ctx = { session: stored.session, generator: stored.generator, send };
      const result = await stored.generator.refine(
        data.prompt!,
        stored.session.protocol,
        stored.session.radioId,
        stored.session.widgetName,
        createRunCallbacks(ctx),
        stored.session
      );

      emitRunCompletion(ctx, result, { action: "refine" });
    } catch (err) {
      const message =
        err instanceof CursorAgentError
          ? `Startup failed: ${err.message}`
          : err instanceof Error
            ? err.message
            : "Unknown error";
      send({ type: "error", content: message, sessionId: effectiveSessionId, success: false });
    } finally {
      store.release(effectiveSessionId);
    }
  });

  return createSseResponse(stream);
}
