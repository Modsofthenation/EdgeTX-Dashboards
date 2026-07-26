import {
  getSessionStore,
  readWidgetLuaSource,
  writeWidgetLuaSource,
} from "~/server/generatorFacade";
import { checkApiAuth } from "~/lib/apiSecurity";
import { getChat, updateChat } from "~/lib/db/chatStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveWorkspaceKey(
  chat: NonNullable<ReturnType<typeof getChat>>,
): string | null {
  return chat.widgetInstanceId ?? chat.artifact?.instanceId ?? chat.widgetName;
}

export async function POST(request: Request): Promise<Response> {
  const authErr = checkApiAuth(request);
  if (authErr) return authErr;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data = body as { chatId?: string };
  if (!data.chatId?.trim()) {
    return Response.json({ error: "chatId is required" }, { status: 400 });
  }

  const chat = getChat(data.chatId);
  if (!chat) {
    return Response.json({ error: "Chat not found" }, { status: 404 });
  }

  const workspaceKey = resolveWorkspaceKey(chat);
  if (!workspaceKey) {
    return Response.json(
      { error: "Chat has no widget to restore" },
      { status: 400 },
    );
  }

  // Do not clobber Layout edits — only seed disk when the workspace Lua is missing.
  if (chat.artifact?.luaSource && !readWidgetLuaSource(workspaceKey)) {
    writeWidgetLuaSource(workspaceKey, chat.artifact.luaSource);
  }

  const store = getSessionStore();
  const session = store.restoreSession({
    id: chat.sessionId ?? undefined,
    radioId: chat.radioId,
    protocol: chat.protocol,
    modelId: chat.modelId,
    widgetName: chat.widgetName ?? chat.artifact?.name ?? undefined,
    widgetInstanceId:
      chat.widgetInstanceId ?? chat.artifact?.instanceId ?? undefined,
    widgetVersion: chat.widgetVersion ?? chat.artifact?.version,
  });

  if (chat.sessionId !== session.id) {
    updateChat(chat.id, { sessionId: session.id });
  }

  return Response.json({
    sessionId: session.id,
    widgetName: session.widgetName ?? chat.widgetName,
    widgetInstanceId: session.widgetInstanceId ?? chat.widgetInstanceId,
    widgetVersion: session.widgetVersion ?? chat.widgetVersion ?? 0,
  });
}
