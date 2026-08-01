import { test, expect } from "@playwright/test";
import { gotoHome } from "../helpers/ui.ts";

/**
 * Optional live AI generation tests.
 * Skipped unless E2E_AI_KEY (or a provider-specific key) is set.
 * Run with: E2E_AI_KEY=... npm run test:e2e -- --project=ai
 */
const aiKey =
  process.env.E2E_AI_KEY ||
  process.env.CURSOR_API_KEY ||
  process.env.ANTHROPIC_API_KEY ||
  process.env.OPENAI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  "";

const provider =
  (process.env.E2E_AI_PROVIDER as
    "cursor" | "anthropic" | "openai" | "gemini" | undefined) ??
  (process.env.ANTHROPIC_API_KEY
    ? "anthropic"
    : process.env.OPENAI_API_KEY
      ? "openai"
      : process.env.GEMINI_API_KEY
        ? "gemini"
        : "cursor");

test.describe("Live AI generation", () => {
  test.skip(!aiKey, "Set E2E_AI_KEY (or provider key) to run live AI E2E");

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      ({ key, providerId }) => {
        try {
          localStorage.setItem("edgetx.firstRunWizard.dismissed.v1", "1");
          localStorage.setItem("widget-gen.ai.provider", providerId);
          localStorage.setItem("widget-gen.ai.rememberKey", "1");
          const localKey =
            providerId === "cursor"
              ? "widget-gen.ai.apiKey.local"
              : `widget-gen.ai.apiKey.${providerId}.local`;
          localStorage.setItem(localKey, key);
        } catch {
          /* ignore */
        }
      },
      { key: aiKey, providerId: provider },
    );
  });

  test("generate a minimal dashboard end-to-end", async ({ page }) => {
    await gotoHome(page);

    await expect(page.getByText("AI not configured")).toHaveCount(0, {
      timeout: 20_000,
    });

    const input = page.getByPlaceholder(/Describe your dashboard/i);
    await input.fill(
      "Minimal TX15 betaflight dashboard with battery voltage and RSSI only. Keep it simple.",
    );
    await page.getByRole("button", { name: "Send message" }).click();

    await expect(
      page.getByText(/Generating|Building|Ready|Preview/i).first(),
    ).toBeVisible({ timeout: 60_000 });

    await expect(
      page
        .getByRole("button", { name: /Download .*\.zip/i })
        .or(page.getByText(/^Ready$/))
        .or(page.getByText(/Needs fixes/)),
    ).toBeVisible({ timeout: 240_000 });
  });
});
