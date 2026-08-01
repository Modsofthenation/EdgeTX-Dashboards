import { test, expect } from "@playwright/test";
import { postJson } from "../helpers/api.ts";
import { gotoHome } from "../helpers/ui.ts";

/**
 * Generation gating without AI keys — always runs in the default chromium project.
 */
test.describe("Generate gate (no AI key)", () => {
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
    expect(body.error).toMatch(/API key|configured|Preferences/i);
  });

  test("sending a prompt surfaces an error in chat", async ({ page }) => {
    await gotoHome(page);

    const input = page.getByPlaceholder(/Describe your dashboard/i);
    await input.fill("Simple link and battery dashboard for TX15");
    await page.getByRole("button", { name: "Send message" }).click();

    // Expect an assistant/error message about missing API key
    await expect(
      page.getByText(/API key|not configured|Preferences|AI/i).first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("Generate with AI on template also fails gracefully", async ({
    page,
  }) => {
    await gotoHome(page);
    await page
      .getByRole("button", { name: "Generate with AI" })
      .first()
      .click();

    await expect(
      page.getByText(/API key|not configured|Preferences|AI|error/i).first(),
    ).toBeVisible({ timeout: 30_000 });
  });
});
