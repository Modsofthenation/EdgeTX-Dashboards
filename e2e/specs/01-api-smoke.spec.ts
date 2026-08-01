import { test, expect } from "@playwright/test";
import {
  createChat,
  getJson,
  postJson,
  putJson,
  seedValidWidget,
} from "../helpers/api.ts";
import {
  INVALID_LUA,
  INVALID_TELEMETRY_LUA,
  VALID_MINIMAL_LUA,
} from "../helpers/lua-fixtures.ts";

test.describe("API smoke", () => {
  test("GET /api/health reports ready", async ({ request }) => {
    const { status, body } = await getJson<{
      ok: boolean;
      service: string;
      ts: string;
    }>(request, "/api/health");
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.service).toBe("edgetx-dashboards");
    expect(Date.parse(body.ts)).not.toBeNaN();
  });

  test("GET /api/radios includes TX15 default", async ({ request }) => {
    const { status, body } = await getJson<{
      defaultId: string;
      radios: Array<{ id: string; name: string; default?: boolean }>;
    }>(request, "/api/radios");
    expect(status).toBe(200);
    expect(body.defaultId).toBe("tx15");
    expect(body.radios.length).toBeGreaterThan(3);
    const tx15 = body.radios.find((r) => r.id === "tx15");
    expect(tx15?.name).toMatch(/TX15/i);
    expect(tx15?.default).toBe(true);
  });

  test("GET /api/models returns a catalog", async ({ request }) => {
    const { status, body } = await getJson<{
      models: Array<{ id: string; label?: string }>;
      defaultId?: string;
      source?: string;
      provider?: string;
    }>(request, "/api/models");
    expect(status).toBe(200);
    expect(body.models.length).toBeGreaterThan(0);
    expect(body.models[0]?.id).toBeTruthy();
  });

  test("GET /api/ai/status is not ready without keys", async ({ request }) => {
    const { status, body } = await getJson<{
      ready: boolean;
      serverKeyConfigured: boolean;
      provider: string;
    }>(request, "/api/ai/status");
    expect(status).toBe(200);
    expect(body.ready).toBe(false);
    expect(body.serverKeyConfigured).toBe(false);
    expect(body.provider).toBeTruthy();
  });

  test("GET /api/sim-firmware reports firmware status", async ({ request }) => {
    const { status, body } = await getJson<{
      ready: boolean;
      radios: Array<{ id: string; present: boolean; ok: boolean }>;
      files: Array<{ name: string; present: boolean }>;
      error?: string;
    }>(request, "/api/sim-firmware");
    expect(status).toBe(200);
    expect(Array.isArray(body.radios)).toBe(true);
    expect(Array.isArray(body.files)).toBe(true);
    // After postinstall sync, TX15 firmware should be present in this environment.
    const tx15 = body.radios.find((r) => r.id === "tx15");
    if (tx15) {
      expect(tx15.present).toBe(true);
    }
  });

  test("chat CRUD lifecycle", async ({ request }) => {
    const created = await createChat(request, {
      title: `API CRUD ${Date.now()}`,
    });

    const listed = await getJson<{
      chats: Array<{ id: string; title: string }>;
    }>(request, "/api/chats?limit=50");
    expect(listed.status).toBe(200);
    expect(listed.body.chats.some((c) => c.id === created.id)).toBe(true);

    const got = await getJson<{ id: string; title: string }>(
      request,
      `/api/chats/${created.id}`,
    );
    expect(got.status).toBe(200);
    expect(got.body.title).toBe(created.title);

    const updated = await putJson<{ id: string; title: string }>(
      request,
      `/api/chats/${created.id}`,
      { title: "Renamed E2E chat" },
    );
    expect(updated.status).toBe(200);
    expect(updated.body.title).toBe("Renamed E2E chat");

    const deleted = await request.delete(`/api/chats/${created.id}`);
    expect(deleted.status()).toBe(204);

    const missing = await request.get(`/api/chats/${created.id}`);
    expect(missing.status()).toBe(404);
  });

  test("POST /api/chats rejects incomplete bodies", async ({ request }) => {
    const { status, body } = await postJson<{ error: string }>(
      request,
      "/api/chats",
      { title: "missing fields" },
    );
    expect(status).toBe(400);
    expect(body.error).toMatch(/required/i);
  });

  test("POST /api/validate accepts golden Lua", async ({ request }) => {
    const { status, body } = await postJson<{
      valid: boolean;
      issues?: Array<{ severity: string; message: string }>;
    }>(request, "/api/validate", {
      source: VALID_MINIMAL_LUA,
      protocol: "betaflight",
      radioId: "tx15",
    });
    expect(status).toBe(200);
    expect(body.valid).toBe(true);
  });

  test("POST /api/validate rejects broken Lua", async ({ request }) => {
    const { status, body } = await postJson<{
      valid: boolean;
      issues?: unknown[];
      error?: string;
    }>(request, "/api/validate", {
      source: INVALID_LUA,
      protocol: "betaflight",
      radioId: "tx15",
    });
    expect([200, 422]).toContain(status);
    expect(body.valid).toBe(false);
  });

  test("POST /api/validate rejects unknown telemetry sensors", async ({
    request,
  }) => {
    const { status, body } = await postJson<{
      valid: boolean;
      issues?: Array<{ message?: string; code?: string }>;
    }>(request, "/api/validate", {
      source: INVALID_TELEMETRY_LUA,
      protocol: "betaflight",
      radioId: "tx15",
    });
    expect([200, 422]).toContain(status);
    expect(body.valid).toBe(false);
  });

  test("widget-source allocate + download zip round-trip", async ({
    request,
  }) => {
    const widget = await seedValidWidget(request);

    const sourceRes = await request.get(
      `/api/widget-source?instanceId=${encodeURIComponent(widget.workspaceKey)}`,
    );
    expect(sourceRes.status()).toBe(200);
    expect(sourceRes.headers()["x-widget-name"]).toBeTruthy();
    const lua = await sourceRes.text();
    expect(lua).toContain("E2EDash");
    expect(lua).toContain("lcd.drawText");

    const release = await getJson<{ valid: boolean }>(
      request,
      `/api/validate?instanceId=${encodeURIComponent(widget.workspaceKey)}&protocol=${widget.protocol}&radioId=${widget.radioId}`,
    );
    expect(release.status).toBe(200);
    expect(release.body.valid).toBe(true);

    const dl = await request.get(
      `/api/download?instanceId=${encodeURIComponent(widget.workspaceKey)}&protocol=${widget.protocol}&radioId=${widget.radioId}`,
    );
    expect(dl.status()).toBe(200);
    expect(dl.headers()["content-type"]).toMatch(/zip|octet-stream/i);
    const buf = await dl.body();
    expect(buf.byteLength).toBeGreaterThan(100);
    // ZIP local file header magic
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });

  test("download returns 422 for invalid on-disk widget after bad validate path", async ({
    request,
  }) => {
    // Allocate with valid source first
    const widget = await seedValidWidget(request);

    // Overwrite via validate-only won't mutate; try writing invalid through put — should 422
    const badPut = await putJson<{ valid?: boolean; error?: string }>(
      request,
      "/api/widget-source",
      {
        source: INVALID_LUA,
        instanceId: widget.workspaceKey,
        protocol: "betaflight",
        radioId: "tx15",
      },
    );
    expect(badPut.status).toBe(422);
    expect(badPut.body.valid).toBe(false);

    // Original valid widget should still download
    const dl = await request.get(
      `/api/download?instanceId=${encodeURIComponent(widget.workspaceKey)}&protocol=betaflight&radioId=tx15`,
    );
    expect(dl.status()).toBe(200);
  });

  test("POST /api/generate returns 503 without AI key", async ({ request }) => {
    const { status, body } = await postJson<{ error: string }>(
      request,
      "/api/generate",
      {
        prompt: "Simple battery and RSSI dashboard",
        radioId: "tx15",
        protocol: "betaflight",
      },
    );
    expect(status).toBe(503);
    expect(body.error).toMatch(/API key/i);
  });

  test("POST /api/refine returns 4xx/503 without session or key", async ({
    request,
  }) => {
    const { status, body } = await postJson<{ error: string }>(
      request,
      "/api/refine",
      {
        sessionId: "nonexistent-session",
        prompt: "Make the battery larger",
      },
    );
    expect([400, 404, 503]).toContain(status);
    expect(body.error).toBeTruthy();
  });

  test("GET /api/install-guide returns guide payload", async ({ request }) => {
    const res = await request.get(
      "/api/install-guide?protocol=betaflight&widget=E2EDash&radioName=TX15&lcdW=480&lcdH=320&touch=1",
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toBeTruthy();
  });

  test("GET /api/widget-package-files lists package paths for seeded widget", async ({
    request,
  }) => {
    const widget = await seedValidWidget(request);
    const res = await request.get(
      `/api/widget-package-files?workspaceKey=${encodeURIComponent(widget.workspaceKey)}`,
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { files: unknown[] };
    expect(Array.isArray(body.files)).toBe(true);
    expect(body.files.length).toBeGreaterThan(0);
  });

  test("widget-source GET returns 204 for unknown or invalid widget keys", async ({
    request,
  }) => {
    const missing = await request.get("/api/widget-source?name=MissingWdg");
    expect(missing.status()).toBe(204);

    // Over-long / invalid names must not 500
    const invalid = await request.get(
      "/api/widget-source?name=DoesNotExistWidgetXYZ",
    );
    expect([204, 400]).toContain(invalid.status());
  });
});
