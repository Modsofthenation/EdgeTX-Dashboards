import { test, expect } from "@playwright/test";
import { putJson, seedValidWidget } from "../helpers/api.ts";
import {
  INVALID_LUA,
  INVALID_TELEMETRY_LUA,
  VALID_MINIMAL_LUA,
} from "../helpers/lua-fixtures.ts";
import { gotoEditor, gotoHome } from "../helpers/ui.ts";

test.describe("Validate & download gates", () => {
  test("valid seeded widget downloads as zip", async ({ request }) => {
    const widget = await seedValidWidget(request);
    const res = await request.get(
      `/api/download?instanceId=${encodeURIComponent(widget.workspaceKey)}&protocol=${widget.protocol}&radioId=${widget.radioId}`,
    );
    expect(res.status()).toBe(200);
    const ctype = res.headers()["content-type"] ?? "";
    expect(ctype).toMatch(/zip|octet-stream|application\/octet-stream/i);
    const bytes = await res.body();
    expect(bytes.byteLength).toBeGreaterThan(200);
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe("PK");
  });

  test("download without identifiers returns 400", async ({ request }) => {
    const res = await request.get("/api/download");
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/i);
  });

  test("download with missing protocol returns 400", async ({ request }) => {
    const widget = await seedValidWidget(request);
    const res = await request.get(
      `/api/download?instanceId=${encodeURIComponent(widget.workspaceKey)}`,
    );
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/protocol/i);
  });

  test("PUT widget-source rejects invalid Lua with 422", async ({
    request,
  }) => {
    const { status, body } = await putJson<{
      valid: boolean;
      error?: string;
      issues?: unknown[];
    }>(request, "/api/widget-source", {
      source: INVALID_LUA,
      protocol: "betaflight",
      radioId: "tx15",
      allocate: true,
    });
    expect(status).toBe(422);
    expect(body.valid).toBe(false);
  });

  test("PUT widget-source rejects unknown sensors", async ({ request }) => {
    const { status, body } = await putJson<{ valid: boolean }>(
      request,
      "/api/widget-source",
      {
        source: INVALID_TELEMETRY_LUA,
        protocol: "betaflight",
        radioId: "tx15",
        allocate: true,
      },
    );
    expect(status).toBe(422);
    expect(body.valid).toBe(false);
  });

  test("GET validate release for seeded widget is valid", async ({
    request,
  }) => {
    const widget = await seedValidWidget(request);
    const res = await request.get(
      `/api/validate?instanceId=${encodeURIComponent(widget.workspaceKey)}&protocol=${widget.protocol}&radioId=${widget.radioId}`,
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { valid: boolean };
    expect(body.valid).toBe(true);
  });

  test("Export Download zip from editor yields a file", async ({
    page,
    request,
  }) => {
    const widget = await seedValidWidget(request);
    await gotoEditor(page, {
      instanceId: widget.workspaceKey,
      protocol: widget.protocol,
      radioId: widget.radioId,
      name: widget.name,
    });

    await page.getByRole("button", { name: "Export" }).click();
    await expect(
      page.getByRole("heading", { name: /Export to radio/i }),
    ).toBeVisible();

    const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
    await page
      .getByRole("button", { name: /Download zip/i })
      .first()
      .click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.zip$/i);
  });

  test("POST validate empty source returns 400", async ({ request }) => {
    const res = await request.post("/api/validate", {
      data: { source: "   ", protocol: "betaflight" },
    });
    expect(res.status()).toBe(400);
  });

  test("golden example file validates via API", async ({ request }) => {
    // Re-read fixture string (inlined) — same as VALID_MINIMAL_LUA
    const res = await request.post("/api/validate", {
      data: {
        source: VALID_MINIMAL_LUA,
        protocol: "betaflight",
        radioId: "tx15",
      },
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { valid: boolean };
    expect(body.valid).toBe(true);
  });

  test("home page does not offer download without artifact", async ({
    page,
  }) => {
    await gotoHome(page);
    await expect(
      page.getByRole("button", { name: /Download .*\.zip/i }),
    ).toHaveCount(0);
  });
});
