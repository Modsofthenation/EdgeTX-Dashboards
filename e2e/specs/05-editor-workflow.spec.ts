import { test, expect } from "@playwright/test";
import { seedValidWidget } from "../helpers/api.ts";
import { gotoEditor } from "../helpers/ui.ts";

test.describe("Editor workflow", () => {
  test("blank editor exposes core chrome and panels", async ({ page }) => {
    await gotoEditor(page, { protocol: "betaflight", radioId: "tx15" });

    await expect(page.getByRole("button", { name: "Insert" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Redo" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Validate" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Simulator" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Export" })).toBeVisible();
    await expect(page.getByRole("button", { name: "More" })).toBeVisible();
  });

  test("Insert menu opens draw kinds and inserts Text", async ({ page }) => {
    await gotoEditor(page, { protocol: "betaflight", radioId: "tx15" });

    await page.getByRole("button", { name: "Insert" }).click();
    const textItem = page
      .getByRole("button", { name: /^Text$/i })
      .or(page.getByText(/^Text$/));
    await expect(textItem.first()).toBeVisible({ timeout: 10_000 });
    await textItem.first().click();

    const layerHint = page
      .getByText(/Text|label|drawText/i)
      .or(page.locator("[data-layer-id]"));
    await expect(layerHint.first()).toBeVisible({ timeout: 10_000 });
  });

  test("Validate on starter scene reports a result", async ({ page }) => {
    await gotoEditor(page, { protocol: "betaflight", radioId: "tx15" });
    await page.getByRole("button", { name: "Validate" }).click();
    await expect(page.getByTestId("editor-validation-status")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("editor-validation-status")).toHaveText(
      /^(Valid|Invalid)$/,
    );
  });

  test("template board loads layers for Minimal quad", async ({ page }) => {
    await gotoEditor(page, {
      template: "minimal-quad",
      protocol: "betaflight",
      radioId: "tx15",
    });

    await expect(page.getByRole("button", { name: "Insert" })).toBeVisible();
    const layers = page.locator("[data-layer-id]");
    await expect
      .poll(async () => layers.count(), { timeout: 20_000 })
      .toBeGreaterThan(0);
  });

  test("Save on template board completes without error dialog", async ({
    page,
  }) => {
    await gotoEditor(page, {
      template: "minimal-quad",
      protocol: "betaflight",
      radioId: "tx15",
    });

    await expect
      .poll(async () => page.locator("[data-layer-id]").count(), {
        timeout: 20_000,
      })
      .toBeGreaterThan(0);

    await page.getByRole("button", { name: "Validate" }).click();
    await expect(page.getByTestId("editor-validation-status")).toBeVisible({
      timeout: 15_000,
    });

    const save = page.getByRole("button", { name: "Save" });
    await expect(save).toBeEnabled({ timeout: 15_000 });
    await save.click();

    await expect(page.getByTestId("editor-validation-status")).toHaveText(
      "Valid",
      { timeout: 20_000 },
    );
    await expect(page.locator('[class*="errorBanner"]')).toHaveCount(0);
  });

  test("Export modal opens Install wizard for seeded instance", async ({
    page,
    request,
  }) => {
    const widget = await seedValidWidget(request);
    await gotoEditor(page, {
      instanceId: widget.workspaceKey,
      protocol: widget.protocol,
      radioId: widget.radioId,
      name: widget.name,
    });

    await page.getByRole("button", { name: "Export" }).click();
    await expect(
      page.getByRole("heading", { name: /Export to radio/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Download zip/i }).first(),
    ).toBeVisible();
  });

  test("Simulator control opens sim UI", async ({ page, request }) => {
    const widget = await seedValidWidget(request);
    await gotoEditor(page, {
      instanceId: widget.workspaceKey,
      protocol: widget.protocol,
      radioId: widget.radioId,
    });

    await page.getByRole("button", { name: "Simulator" }).click();
    await expect(
      page.getByRole("heading", { name: "Run in simulator" }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("More menu exposes Preferences", async ({ page }) => {
    await gotoEditor(page);
    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: /Preferences/i }).click();
    await expect(
      page.getByRole("dialog", { name: "Preferences" }),
    ).toBeVisible();
  });

  test("narrow viewport still exposes editor actions", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoEditor(page, { protocol: "betaflight", radioId: "tx15" });
    await expect(
      page.getByRole("button", { name: /Save|Insert|Sim|Export/i }).first(),
    ).toBeVisible();
  });
});
