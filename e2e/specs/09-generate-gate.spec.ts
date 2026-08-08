import { test, expect } from "@playwright/test";
import { postJson } from "../helpers/api.ts";
import { gotoStudio } from "../helpers/ui.ts";

/**
 * Generation gating without AI keys.
 * Skipped when E2E_ALLOW_SERVER_AI=1 because the webServer inherits host keys.
 */
test.describe("Generate gate (no AI key)", () => {
  test.skip(
    process.env.E2E_ALLOW_SERVER_AI === "1",
    "Server AI keys are enabled; the no-key paths cannot be exercised.",
  );

  test("API generate is blocked with 503", async ({ request }) => {
    const { status, body } = await postJson<{ error: string }>(
      request,
      "/api/generate",
      {
        prompt: "Battery and RSSI cards for TX15",
        radioId: "tx15",
        protocol: "betaflight",
        modelId: "auto",
      },
    );
    expect(status).toBe(503);
    expect(body.error).toMatch(/API key|configured|Settings|Preferences/i);
  });

  test("sending a prompt is blocked until AI is configured", async ({
    page,
  }) => {
    await gotoStudio(page);

    await expect(page.getByText(/AI not configured/i).first()).toBeVisible({
      timeout: 15_000,
    });

    const input = page.getByPlaceholder(/Describe your dashboard/i);
    await input.fill("Simple link and battery dashboard for TX15");
    const send = page.getByRole("button", { name: "Send message" });
    await expect(send).toBeDisabled();
  });

  test("Generate with AI on template is disabled without a key", async ({
    page,
  }) => {
    await gotoStudio(page);
    await expect(page.getByText(/AI not configured/i).first()).toBeVisible({
      timeout: 15_000,
    });
    const aiBtn = page
      .getByRole("button", { name: "Generate with AI" })
      .first();
    await expect(aiBtn).toBeDisabled();
  });
});
