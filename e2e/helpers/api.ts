import type { APIRequestContext } from "@playwright/test";
import { VALID_MINIMAL_LUA } from "./lua-fixtures.ts";

export type SeededWidget = {
  workspaceKey: string;
  name: string;
  protocol: string;
  radioId: string;
};

export async function getJson<T>(
  request: APIRequestContext,
  path: string,
): Promise<{ status: number; body: T }> {
  const res = await request.get(path);
  const body = (await res.json()) as T;
  return { status: res.status(), body };
}

export async function postJson<T>(
  request: APIRequestContext,
  path: string,
  data: unknown,
): Promise<{ status: number; body: T }> {
  const res = await request.post(path, { data });
  const text = await res.text();
  let body: T;
  try {
    body = JSON.parse(text) as T;
  } catch {
    body = text as unknown as T;
  }
  return { status: res.status(), body };
}

export async function putJson<T>(
  request: APIRequestContext,
  path: string,
  data: unknown,
): Promise<{ status: number; body: T }> {
  const res = await request.put(path, { data });
  const text = await res.text();
  let body: T;
  try {
    body = JSON.parse(text) as T;
  } catch {
    body = text as unknown as T;
  }
  return { status: res.status(), body };
}

/** Persist a valid widget instance via PUT /api/widget-source (allocate). */
export async function seedValidWidget(
  request: APIRequestContext,
  overrides: {
    source?: string;
    protocol?: string;
    radioId?: string;
    name?: string;
  } = {},
): Promise<SeededWidget> {
  const protocol = overrides.protocol ?? "betaflight";
  const radioId = overrides.radioId ?? "tx15";
  const source = overrides.source ?? VALID_MINIMAL_LUA;

  const { status, body } = await putJson<{
    valid?: boolean;
    workspaceKey?: string;
    error?: string;
    issues?: unknown[];
  }>(request, "/api/widget-source", {
    source,
    protocol,
    radioId,
    allocate: true,
  });

  if (status !== 200 || !body.workspaceKey) {
    throw new Error(
      `seedValidWidget failed (${status}): ${JSON.stringify(body)}`,
    );
  }

  return {
    workspaceKey: body.workspaceKey,
    name: overrides.name ?? "E2EDash",
    protocol,
    radioId,
  };
}

export async function createChat(
  request: APIRequestContext,
  overrides: {
    title?: string;
    protocol?: string;
    modelId?: string;
    radioId?: string;
  } = {},
): Promise<{ id: string; title: string }> {
  const { status, body } = await postJson<{
    id?: string;
    title?: string;
    error?: string;
  }>(request, "/api/chats", {
    title: overrides.title ?? `E2E chat ${Date.now()}`,
    protocol: overrides.protocol ?? "betaflight",
    modelId: overrides.modelId ?? "auto",
    radioId: overrides.radioId ?? "tx15",
    edgeTxVersion: "2.11.0",
  });

  if (status !== 201 || !body.id) {
    throw new Error(`createChat failed (${status}): ${JSON.stringify(body)}`);
  }

  return { id: body.id, title: body.title ?? "" };
}
