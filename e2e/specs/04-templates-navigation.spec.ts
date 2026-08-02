import { test, expect } from "@playwright/test";
import {
  gotoEditor,
  gotoHome,
  gotoStudio,
  gotoTemplates,
  primaryNavLink,
} from "../helpers/ui.ts";

test.describe("Templates & navigation", () => {
  test("Build in Editor from Studio navigates to blank editor", async ({
    page,
  }) => {
    await gotoStudio(page);
    await page.getByRole("link", { name: "Build in Editor (no AI)" }).click();
    await expect(page).toHaveURL(/\/editor/);
    await expect(page.getByRole("button", { name: "Insert" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Validate" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
  });

  test("Open in Editor for Minimal quad loads editor with template query", async ({
    page,
  }) => {
    await gotoStudio(page);
    await page
      .getByRole("button", { name: /Minimal quad[\s\S]*Open in Editor/i })
      .click();
    await expect(page).toHaveURL(/\/editor\?/);
    await expect(page).toHaveURL(/template=/);
    await expect(page.getByRole("button", { name: "Insert" })).toBeVisible();
  });

  test("Editor suggestion chip opens editor", async ({ page }) => {
    await gotoStudio(page);
    await page
      .getByRole("button", { name: /Minimal quad[\s\S]*Open in Editor/i })
      .click();
    await expect(page).toHaveURL(/\/editor/);
  });

  test("chrome Editor and Studio round-trip", async ({ page }) => {
    await gotoHome(page);
    await primaryNavLink(page, "Editor").click();
    await expect(page).toHaveURL(/\/editor/);
    await expect(primaryNavLink(page, "Editor")).toHaveAttribute(
      "aria-current",
      "page",
    );

    await primaryNavLink(page, "Studio").click();
    await expect(page).toHaveURL(/\/studio/);
    await expect(primaryNavLink(page, "Studio")).toHaveAttribute(
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
    await expect(page.getByText("Recent projects")).toBeVisible();
  });

  test("templates page filters and opens RF heli", async ({ page }) => {
    await gotoTemplates(page);
    const filters = page.getByRole("group", { name: "Filter by protocol" });
    await expect(filters).toBeVisible();
    await filters.getByRole("button", { name: /Rotorflight/i }).click();
    await page.getByRole("link", { name: "Open in Editor" }).first().click();
    await expect(page).toHaveURL(/\/editor/);
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
