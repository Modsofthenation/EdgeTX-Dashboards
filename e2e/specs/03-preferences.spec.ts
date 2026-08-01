import { test, expect } from "@playwright/test";
import { closePreferences, gotoHome, openPreferences } from "../helpers/ui.ts";

test.describe("Preferences", () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page);
  });

  test("opens Appearance tab with theme swatches", async ({ page }) => {
    await openPreferences(page, "Appearance");
    const dialog = page.getByRole("dialog", { name: "Preferences" });
    await expect(
      dialog.getByRole("tab", { name: "Appearance" }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(dialog.locator("[data-theme-preview]").first()).toBeVisible();
    await expect(dialog.getByText("Dark")).toBeVisible();
    await expect(dialog.getByText("Light")).toBeVisible();
  });

  test("switching theme updates document attribute", async ({ page }) => {
    await openPreferences(page, "Appearance");
    const dialog = page.getByRole("dialog", { name: "Preferences" });
    const forest = dialog.locator('[data-theme-preview="forest"]');
    await forest.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "forest");

    const midnight = dialog.locator('[data-theme-preview="midnight"]');
    await midnight.click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      "midnight",
    );
    await closePreferences(page);
  });

  test("AI tab shows provider controls and not-configured status", async ({
    page,
  }) => {
    await openPreferences(page, "AI");
    const dialog = page.getByRole("dialog", { name: "Preferences" });
    await expect(dialog.getByText(/AI provider/i)).toBeVisible();
    await expect(dialog.getByText(/Not configured|Checking/i)).toBeVisible();
    await expect(dialog.locator("select").first()).toBeVisible();
  });

  test("AI banner Open AI settings opens Preferences AI tab", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Open AI settings" }).click();
    const dialog = page.getByRole("dialog", { name: "Preferences" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("tab", { name: "AI" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("Simulator WASM tab shows firmware status", async ({ page }) => {
    await openPreferences(page, "Simulator WASM");
    const dialog = page.getByRole("dialog", { name: "Preferences" });
    await expect(
      dialog.getByText(/WASM|firmware|simulator/i).first(),
    ).toBeVisible();
    // Soft assert ready state when assets synced
    const ready = dialog.getByText(/ready|present|Download WASM/i).first();
    await expect(ready).toBeVisible();
  });

  test("Escape closes preferences", async ({ page }) => {
    await openPreferences(page);
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "Preferences" }),
    ).toBeHidden();
  });

  test("preferences survive navigation to Layout and back", async ({
    page,
  }) => {
    await openPreferences(page, "Appearance");
    const dialog = page.getByRole("dialog", { name: "Preferences" });
    await dialog.locator('[data-theme-preview="ocean"]').click();
    await closePreferences(page);

    await page.getByRole("link", { name: "Layout" }).click();
    await expect(page).toHaveURL(/\/editor/);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "ocean");

    await page.getByRole("link", { name: "Generate" }).click();
    await expect(page).toHaveURL(/\/(\?|$)/);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "ocean");
  });
});
