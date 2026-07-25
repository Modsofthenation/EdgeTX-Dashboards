import {
  CursorAgentError,
  getSessionStore,
  validatePromptImages,
  writeWidgetLuaSource,
  readWidgetLuaSource,
} from "~/server/generatorFacade";
import type { RefineHistoryInput } from "@widget-gen/generator";
import { checkApiAuth } from "~/lib/apiSecurity";
import { resolveCursorApiKey } from "~/server/cursorApiKey";
import { getChat } from "~/lib/db/chatStore";
import { buildRefineHistoryInput } from "~/lib/refineChatContext";
import { createSseResponse, createSseStream } from "~/lib/sse";
import { createRunCallbacks, emitRunCompletion } from "~/lib/widgetSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveRefineSession(
  sessionId: string,
  chatId?: string,
  apiKey?: string,
) {
  const store = getSessionStore();
  let effectiveSessionId = sessionId;
  let stored = store.get(sessionId);

  if (!stored && chatId) {
    const chat = getChat(chatId);
    if (!chat) {
      return { store, stored, sessionId: effectiveSessionId };
    }
    const workspaceKey =
      chat.widgetInstanceId ?? chat.artifact?.instanceId ?? chat.widgetName;
    if (workspaceKey) {
      if (chat.artifact?.luaSource) {
        writeWidgetLuaSource(workspaceKey, chat.artifact.luaSource);
      }
      const restored = store.restoreSession({
        id: chat.sessionId ?? sessionId,
        radioId: chat.radioId,
        protocol: chat.protocol,
        modelId: chat.modelId,
        widgetName: chat.widgetName ?? chat.artifact?.name ?? undefined,
        widgetInstanceId:
          chat.widgetInstanceId ?? chat.artifact?.instanceId ?? undefined,
        widgetVersion: chat.widgetVersion ?? chat.artifact?.version,
        apiKey,
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

  const apiKey = resolveCursorApiKey(request);
  if (!apiKey) {
    return Response.json(
      {
        error:
          "No Cursor API key configured. Add one in Preferences → AI, or set CURSOR_API_KEY on the server.",
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data = body as {
    sessionId?: string;
    chatId?: string;
    prompt?: string;
    images?: unknown;
  };

  const imagesResult = validatePromptImages(data.images);
  if (!imagesResult.ok) {
    return Response.json({ error: imagesResult.error }, { status: 400 });
  }

  const prompt = data.prompt?.trim() ?? "";
  if (!prompt && imagesResult.images.length === 0) {
    return Response.json(
      { error: "prompt or at least one reference image is required" },
      { status: 400 },
    );
  }
  if (prompt.length > 8000) {
    return Response.json(
      { error: "prompt exceeds maximum length (8000)" },
      { status: 400 },
    );
  }

  const effectivePrompt =
    prompt ||
    "Update this dashboard to match the attached reference image(s) as the primary layout and style guide.";

  if (!data.sessionId?.trim()) {
    return Response.json({ error: "sessionId is required" }, { status: 400 });
  }

  const {
    store,
    stored,
    sessionId: effectiveSessionId,
  } = resolveRefineSession(data.sessionId, data.chatId?.trim(), apiKey);
  if (!stored) {
    return Response.json(
      { error: "Session not found or expired" },
      { status: 404 },
    );
  }

  const chat = data.chatId?.trim() ? getChat(data.chatId.trim()) : null;
  const workspaceKey =
    stored.session.widgetInstanceId ??
    chat?.widgetInstanceId ??
    chat?.artifact?.instanceId ??
    undefined;
  const workspaceLua = workspaceKey
    ? readWidgetLuaSource(workspaceKey)?.source
    : null;

  let refineHistory: RefineHistoryInput | undefined;
  if (chat) {
    refineHistory = buildRefineHistoryInput(
      chat,
      effectivePrompt,
      workspaceLua,
    );
  } else if (workspaceLua) {
    refineHistory = {
      messages: [],
      currentPrompt: effectivePrompt,
      artifact: {
        version: stored.session.widgetVersion ?? 0,
        luaSource: workspaceLua,
        validated: stored.session.validated ?? false,
      },
      artifactVersions: [],
      workspaceLuaSource: workspaceLua,
    };
  }

  const stream = createSseStream(async (send) => {
    if (!store.tryAcquire(effectiveSessionId)) {
      send({
        type: "error",
        content: "Session busy",
        sessionId: effectiveSessionId,
        success: false,
      });
      return;
    }

    try {
      const ctx = {
        session: stored.session,
        generator: stored.generator,
        send,
      };
      const result = await stored.generator.refine(
        effectivePrompt,
        stored.session.protocol,
        stored.session.radioId,
        stored.session.widgetName,
        createRunCallbacks(ctx),
        stored.session,
        imagesResult.images.length > 0 ? imagesResult.images : undefined,
        refineHistory,
      );

      emitRunCompletion(ctx, result, { action: "refine" });
    } catch (err) {
      const message =
        err instanceof CursorAgentError
          ? `Startup failed: ${err.message}`
          : err instanceof Error
            ? err.message
            : "Unknown error";
      send({
        type: "error",
        content: message,
        sessionId: effectiveSessionId,
        success: false,
      });
    } finally {
      store.release(effectiveSessionId);
    }
  });

  return createSseResponse(stream);
}
