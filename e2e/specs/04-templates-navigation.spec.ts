import { test, expect } from "@playwright/test";
import { gotoEditor, gotoHome, primaryNavLink } from "../helpers/ui.ts";

test.describe("Templates & navigation", () => {
  test("Build in Layout navigates to blank editor", async ({ page }) => {
    await gotoHome(page);
    await page.getByRole("link", { name: "Build in Layout (no AI)" }).click();
    await expect(page).toHaveURL(/\/editor/);
    await expect(page.getByRole("button", { name: "Insert" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Validate" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
  });

  test("Open in Layout for Minimal quad loads editor with template query", async ({
    page,
  }) => {
    await gotoHome(page);
    await page
      .getByRole("button", { name: /Minimal quad[\s\S]*Open in Layout/i })
      .click();
    await expect(page).toHaveURL(/\/editor\?/);
    await expect(page).toHaveURL(/template=/);
    await expect(page.getByRole("button", { name: "Insert" })).toBeVisible();
  });

  test("Layout suggestion chip opens editor", async ({ page }) => {
    await gotoHome(page);
    await page.getByRole("button", { name: /Layout: Minimal quad/i }).click();
    await expect(page).toHaveURL(/\/editor/);
  });

  test("chrome Layout and Generate round-trip", async ({ page }) => {
    await gotoHome(page);
    await primaryNavLink(page, "Layout").click();
    await expect(page).toHaveURL(/\/editor/);
    await expect(primaryNavLink(page, "Layout")).toHaveAttribute(
      "aria-current",
      "page",
    );

    await primaryNavLink(page, "Generate").click();
    await expect(page).toHaveURL(/\/(\?|$)/);
    await expect(primaryNavLink(page, "Generate")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("logo returns home from editor", async ({ page }) => {
    await gotoEditor(page);
    await page
      .getByRole("link", { name: "EdgeTX Dashboard Generator home" })
      .click();
    await expect(page).toHaveURL(/\/(\?|$)/);
    await expect(
      page.getByRole("heading", { name: "What should your dashboard show?" }),
    ).toBeVisible();
  });

  test("RF heli template opens with rotorflight protocol", async ({ page }) => {
    await gotoHome(page);
    const filters = page.getByRole("group", { name: "Template variants" });
    const rf = filters.getByRole("button", { name: /RF electric/i });
    if (await rf.isVisible()) {
      await rf.click();
    }
    await page
      .getByRole("button", {
        name: /RF heli \(electric\)[\s\S]*Open in Layout/i,
      })
      .click();
    await expect(page).toHaveURL(/protocol=rotorflight/);
  });

  test("direct editor URL with template param works", async ({ page }) => {
    await gotoEditor(page, {
      template: "minimal-quad",
      protocol: "betaflight",
      radioId: "tx15",
    });
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Simulator" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Export" })).toBeVisible();
  });
});
