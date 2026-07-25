import { checkApiAuth } from "~/lib/apiSecurity";
import { createChat, listChats, type CreateChatInput } from "~/lib/db/chatStore";
import type { TelemetryProtocol } from "@widget-gen/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const authErr = checkApiAuth(request);
  if (authErr) return authErr;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100);

  return Response.json({ chats: listChats(limit) });
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

  const data = body as Partial<CreateChatInput>;
  if (!data.title?.trim() || !data.protocol || !data.modelId) {
    return Response.json({ error: "title, protocol, and modelId are required" }, { status: 400 });
  }

  const chat = createChat({
    title: data.title.trim(),
    protocol: data.protocol as TelemetryProtocol,
    modelId: data.modelId,
    edgeTxVersion: data.edgeTxVersion ?? "2.11.0",
    radioId: data.radioId,
  });

  return Response.json(chat, { status: 201 });
}
