import { test, expect } from "@playwright/test";
import {
  closePreferences,
  gotoHome,
  gotoSettings,
  openPreferences,
  primaryNavLink,
} from "../helpers/ui.ts";

test.describe("Settings", () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page);
  });

  test("opens Appearance tab with theme swatches", async ({ page }) => {
    await openPreferences(page, "Appearance");
    await expect(page.getByRole("tab", { name: "Appearance" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.locator("[data-theme-preview]").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^Dark\b/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Light\b/ })).toBeVisible();
  });

  test("switching theme updates document attribute", async ({ page }) => {
    await gotoSettings(page, "appearance");
    const forest = page.locator('[data-theme-preview="forest"]');
    await forest.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "forest");

    const midnight = page.locator('[data-theme-preview="midnight"]');
    await midnight.click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      "midnight",
    );
  });

  test("AI tab shows provider controls and not-configured status", async ({
    page,
  }) => {
    await gotoSettings(page, "ai");
    await expect(page.getByText("AI provider", { exact: true })).toBeVisible();
    await expect(
      page.getByText(/Not configured|Checking/i).first(),
    ).toBeVisible();
    await expect(page.locator("select").first()).toBeVisible();
  });

  test("AI banner Open AI settings opens Settings AI tab", async ({ page }) => {
    await primaryNavLink(page, "Studio").click();
    await page.getByRole("button", { name: "Open AI settings" }).click();
    await expect(page).toHaveURL(/\/settings\?tab=ai/);
    await expect(
      page.getByRole("tab", { name: "AI providers" }),
    ).toHaveAttribute("aria-selected", "true");
  });

  test("Simulator tab shows firmware status", async ({ page }) => {
    await gotoSettings(page, "simulator");
    await expect(
      page.getByText(/WASM|firmware|simulator/i).first(),
    ).toBeVisible();
    const ready = page.getByText(/ready|present|Download WASM/i).first();
    await expect(ready).toBeVisible();
  });

  test("settings survive navigation to Editor and back", async ({ page }) => {
    await gotoSettings(page, "appearance");
    await page.locator('[data-theme-preview="ocean"]').click();

    await primaryNavLink(page, "Editor").click();
    await expect(page).toHaveURL(/\/editor/);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "ocean");

    await primaryNavLink(page, "Home").click();
    await expect(page).toHaveURL(/\/(\?|$)/);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "ocean");
    await closePreferences(page);
  });
});
