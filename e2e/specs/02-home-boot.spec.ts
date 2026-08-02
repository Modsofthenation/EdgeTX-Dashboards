import { test, expect } from "@playwright/test";
import {
  dismissFirstRunWizard,
  gotoHome,
  gotoStudio,
  primaryNavLink,
} from "../helpers/ui.ts";

test.describe("Home boot & empty state", () => {
  test("loads product chrome and home library", async ({ page }) => {
    await gotoHome(page);

    await expect(
      page.getByRole("link", { name: "EdgeTX Dashboard Generator home" }),
    ).toBeVisible();
    await expect(page.getByText("EdgeTX Dashboards")).toBeVisible();
    await expect(primaryNavLink(page, "Home")).toBeVisible();
    await expect(primaryNavLink(page, "Studio")).toBeVisible();
    await expect(primaryNavLink(page, "Editor")).toBeVisible();
    await expect(page.getByText("AI Studio")).toBeVisible();
    await expect(page.getByText("Recent projects")).toBeVisible();
    await expect(page.getByRole("link", { name: "Describe…" })).toBeVisible();
  });

  test("studio shows AI-not-configured banner when no keys", async ({
    page,
  }) => {
    await gotoStudio(page);
    await expect(page.getByText("AI not configured")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Open Editor" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Open AI settings" }),
    ).toBeVisible();
  });

  test("first-run wizard appears for fresh visitors", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    const dialog = page.getByRole("dialog", { name: "Set up AI generation" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Skip for now" }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("link", { name: "Open Editor" }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Open AI settings" }),
    ).toBeVisible();

    await dialog.getByRole("button", { name: "Skip for now" }).click();
    await expect(dialog).toBeHidden();
  });

  test("skipping wizard remembers dismissal", async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.clear();
      } catch {
        /* ignore */
      }
    });
    await page.goto("/");
    const dialog = page.getByRole("dialog", { name: "Set up AI generation" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Skip for now" }).click();
    await page.reload();
    await expect(dialog).toBeHidden();
  });

  test("New chat button is available in Studio", async ({ page }) => {
    await gotoStudio(page);
    await expect(page.getByRole("button", { name: "New chat" })).toBeEnabled();
  });

  test("composer has send control and settings", async ({ page }) => {
    await gotoStudio(page);
    await expect(
      page.getByPlaceholder(/Describe your dashboard/i),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send message" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Attach images" }),
    ).toBeVisible();

    const settings = page.getByRole("button", { name: /Settings|settings/i });
    if (await settings.isVisible().catch(() => false)) {
      await settings.click();
      await expect(
        page.getByText(/Radio|Protocol|Model/i).first(),
      ).toBeVisible();
    }
  });

  test("how-it-works steps are listed in Studio", async ({ page }) => {
    await gotoStudio(page);
    const steps = page.getByRole("list", { name: "How it works" });
    await expect(steps).toBeVisible();
    await expect(steps.getByText(/Describe/i)).toBeVisible();
    await expect(steps.getByText(/Preview/i)).toBeVisible();
    await expect(steps.getByText(/Download/i)).toBeVisible();
  });

  test("studio empty state shows template gallery", async ({ page }) => {
    await gotoStudio(page);
    const filters = page.getByRole("group", { name: "Template variants" });
    await expect(filters).toBeVisible();

    await expect(
      page.getByRole("button", { name: /Minimal quad/i }).first(),
    ).toBeVisible();

    const rfElectric = filters.getByRole("button", { name: /RF electric/i });
    if (await rfElectric.isVisible()) {
      await rfElectric.click();
      await expect(
        page.getByRole("button", { name: /RF heli \(electric\)/i }).first(),
      ).toBeVisible();
    }

    const all = filters.getByRole("button", { name: /^All$/i });
    await all.click();
    await expect(
      page.getByRole("button", { name: /Minimal quad/i }).first(),
    ).toBeVisible();
  });

  test("Generate with AI is present on studio templates", async ({ page }) => {
    await gotoStudio(page);
    const aiButtons = page.getByRole("button", { name: "Generate with AI" });
    await expect(aiButtons.first()).toBeVisible();
  });

  test("favicon / document title is set", async ({ page }) => {
    await dismissFirstRunWizard(page);
    await page.goto("/");
    await expect(page).toHaveTitle(/EdgeTX|Dashboard/i);
  });
});
