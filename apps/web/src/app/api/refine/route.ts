import {
  formatAgentStartupError,
  getSessionStore,
  validatePromptImages,
  writeWidgetLuaSource,
  readWidgetLuaSource,
} from "~/server/generatorFacade";
import type { RefineHistoryInput } from "@widget-gen/generator";
import type { AiProviderId } from "@widget-gen/shared";
import { parseAiProviderId, providerMeta } from "@widget-gen/shared";
import { checkApiAuth, checkRateLimit } from "~/lib/apiSecurity";
import { resolveProviderApiKey } from "~/server/aiProviderKey";
import { getChat } from "~/lib/db/chatStore";
import { buildRefineHistoryInput } from "~/lib/refineChatContext";
import { createSseResponse, createSseStream } from "~/lib/sse";
import { createRunCallbacks, emitRunCompletion } from "~/lib/widgetSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveRefineSession(
  sessionId: string,
  chatId: string | undefined,
  apiKey: string | undefined,
  provider: AiProviderId,
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
        provider,
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

  const rateErr = checkRateLimit(request);
  if (rateErr) return rateErr;

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
  const persistedChat = data.chatId?.trim()
    ? getChat(data.chatId.trim())
    : null;
  const provider = parseAiProviderId(
    persistedChat?.provider ?? request.headers.get("x-ai-provider"),
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

  let store;
  let stored;
  let effectiveSessionId: string;
  try {
    const resolved = resolveRefineSession(
      data.sessionId,
      data.chatId?.trim(),
      apiKey,
      provider,
    );
    store = resolved.store;
    stored = resolved.stored;
    effectiveSessionId = resolved.sessionId;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/refine] session resolve failed:", message);
    return Response.json(
      {
        error: message.includes("repository root")
          ? "Desktop package is missing generator assets (knowledge/). Reinstall from a fresh desktop build."
          : message,
      },
      { status: 500 },
    );
  }
  if (!stored) {
    return Response.json(
      { error: "Session not found or expired" },
      { status: 404 },
    );
  }

  const chat = persistedChat;
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

  const stream = createSseStream(
    async (send) => {
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
          { signal: request.signal },
        );

        emitRunCompletion(ctx, result, { action: "refine" });
      } catch (err) {
        if (request.signal.aborted) {
          return;
        }
        const message = formatAgentStartupError(err);
        send({
          type: "error",
          content: message,
          sessionId: effectiveSessionId,
          success: false,
        });
      } finally {
        store.release(effectiveSessionId);
      }
    },
    { signal: request.signal },
  );

  return createSseResponse(stream);
}
