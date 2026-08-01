import { test, expect } from "@playwright/test";
import { getJson } from "../helpers/api.ts";
import { gotoHome, openPreferences } from "../helpers/ui.ts";

test.describe("Simulator firmware", () => {
  test("API reports TX15 wasm presence after sync", async ({ request }) => {
    const { status, body } = await getJson<{
      ready: boolean;
      radios: Array<{
        id: string;
        present: boolean;
        ok: boolean;
        name: string;
      }>;
      files: Array<{ name: string; present: boolean }>;
      defaultVersion?: string | null;
    }>(request, "/api/sim-firmware");

    expect(status).toBe(200);
    expect(body.radios.length).toBeGreaterThan(0);

    test.skip(
      !body.ready,
      "WASM firmware not synced — run npm run sync-wasm (or postinstall) first",
    );

    const tx15 = body.radios.find((r) => r.id === "tx15");
    expect(tx15).toBeTruthy();
    expect(tx15!.present).toBe(true);
    expect(tx15!.ok).toBe(true);
  });

  test("Preferences Simulator tab reflects API readiness", async ({
    page,
    request,
  }) => {
    const { body } = await getJson<{ ready: boolean }>(
      request,
      "/api/sim-firmware",
    );

    await gotoHome(page);
    await openPreferences(page, "Simulator WASM");
    const dialog = page.getByRole("dialog", { name: "Preferences" });

    if (body.ready) {
      await expect(dialog.getByText(/ready|OK|present/i).first()).toBeVisible();
    } else {
      await expect(
        dialog.getByRole("button", { name: /Download WASM/i }),
      ).toBeVisible();
    }
  });

  test("sim static assets are served", async ({ request }) => {
    const manifest = await request.get("/sim/manifest.json");
    expect(manifest.status()).toBe(200);
    const json = (await manifest.json()) as Record<string, unknown>;
    expect(json).toBeTruthy();
  });
});
