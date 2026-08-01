import { test, expect } from "@playwright/test";
import {
  dismissFirstRunWizard,
  gotoHome,
  primaryNavLink,
} from "../helpers/ui.ts";

test.describe("Home boot & empty state", () => {
  test("loads product chrome and empty dashboard prompt", async ({ page }) => {
    await gotoHome(page);

    await expect(
      page.getByRole("link", { name: "EdgeTX Dashboard Generator home" }),
    ).toBeVisible();
    await expect(page.getByText("EdgeTX Dashboards")).toBeVisible();
    await expect(primaryNavLink(page, "Generate")).toBeVisible();
    await expect(primaryNavLink(page, "Layout")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "What should your dashboard show?" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Build in Layout (no AI)" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Start from a template" }),
    ).toBeVisible();
  });

  test("shows AI-not-configured banner when no keys", async ({ page }) => {
    await gotoHome(page);
    await expect(page.getByText("AI not configured")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Open Layout" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Open AI settings" }),
    ).toBeVisible();
  });

  test("first-run wizard appears for fresh visitors", async ({ page }) => {
    // Do not dismiss — clear storage and load
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    const dialog = page.getByRole("dialog", { name: "Set up AI generation" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Skip for now" }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("link", { name: "Open Layout" }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Open AI preferences" }),
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

  test("New chat button is available", async ({ page }) => {
    await gotoHome(page);
    await expect(page.getByRole("button", { name: "New chat" })).toBeEnabled();
  });

  test("composer has send control and settings", async ({ page }) => {
    await gotoHome(page);
    await expect(
      page.getByPlaceholder(/Describe your dashboard/i),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send message" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Attach images" }),
    ).toBeVisible();

    // Open composer settings if present
    const settings = page.getByRole("button", { name: /Settings|settings/i });
    if (await settings.isVisible().catch(() => false)) {
      await settings.click();
      await expect(
        page.getByText(/Radio|Protocol|Model/i).first(),
      ).toBeVisible();
    }
  });

  test("how-it-works steps are listed", async ({ page }) => {
    await gotoHome(page);
    const steps = page.getByRole("list", { name: "How it works" });
    await expect(steps).toBeVisible();
    await expect(steps.getByText(/Describe/i)).toBeVisible();
    await expect(steps.getByText(/Preview/i)).toBeVisible();
    await expect(steps.getByText(/Download/i)).toBeVisible();
  });

  test("template variant filters switch gallery", async ({ page }) => {
    await gotoHome(page);
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

  test("Generate with AI is present on templates", async ({ page }) => {
    await gotoHome(page);
    const aiButtons = page.getByRole("button", { name: "Generate with AI" });
    await expect(aiButtons.first()).toBeVisible();
  });

  test("favicon / document title is set", async ({ page }) => {
    await dismissFirstRunWizard(page);
    await page.goto("/");
    await expect(page).toHaveTitle(/EdgeTX|Dashboard/i);
  });
});
