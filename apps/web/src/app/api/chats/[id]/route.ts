import { checkApiAuth } from "~/lib/apiSecurity";
import {
  deleteChat,
  getChat,
  updateChat,
  type UpdateChatInput,
} from "~/lib/db/chatStore";
import { parseAiProviderId } from "@widget-gen/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const authErr = checkApiAuth(request);
  if (authErr) return authErr;

  const { id } = await context.params;
  const chat = getChat(id);
  if (!chat) {
    return Response.json({ error: "Chat not found" }, { status: 404 });
  }

  return Response.json(chat);
}

export async function PUT(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const authErr = checkApiAuth(request);
  if (authErr) return authErr;

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const raw = body as UpdateChatInput;
    const input: UpdateChatInput = {
      ...raw,
      ...(raw.provider !== undefined
        ? { provider: parseAiProviderId(raw.provider) }
        : {}),
    };
    const chat = updateChat(id, input);
    if (!chat) {
      return Response.json({ error: "Chat not found" }, { status: 404 });
    }

    return Response.json(chat);
  } catch (err) {
    console.error("[PUT /api/chats/:id]", err);
    const message = err instanceof Error ? err.message : "Failed to save chat";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const authErr = checkApiAuth(request);
  if (authErr) return authErr;

  const { id } = await context.params;
  const removed = deleteChat(id);
  if (!removed) {
    return Response.json({ error: "Chat not found" }, { status: 404 });
  }

  return new Response(null, { status: 204 });
}
