import { test, expect } from "@playwright/test";
import { seedValidWidget, getJson } from "../helpers/api.ts";
import { gotoEditor } from "../helpers/ui.ts";
import {
  importLuaInEditor,
  markRadioPreviewCanvas,
  radioPreviewMarkStillPresent,
  radioSimPhaseIsRunning,
  readRadioPreviewBitmap,
  waitForRadioPreviewChange,
  waitForRadioPreviewReady,
} from "../helpers/editorPreview.ts";
import {
  HOT_RELOAD_ALT_LUA,
  VALID_MINIMAL_LUA,
} from "../helpers/lua-fixtures.ts";

/**
 * Confirms editor radio preview hot-reloads via the loadScript shim:
 * body.lua rewrite updates pixels without soft-restarting WASM.
 */
test.describe("Editor radio preview hot-reload", () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeEach(async ({ request }) => {
    const { status, body } = await getJson<{ ready?: boolean }>(
      request,
      "/api/sim-firmware",
    );
    test.skip(
      status !== 200 || body.ready !== true,
      "WASM firmware not synced — run npm run sync-wasm first",
    );
  });

  test("import alternate Lua updates pixels without soft-restart", async ({
    page,
    request,
  }) => {
    const widget = await seedValidWidget(request, {
      source: VALID_MINIMAL_LUA,
      name: "E2EDash",
    });
    await gotoEditor(page, {
      instanceId: widget.workspaceKey,
      protocol: widget.protocol,
      radioId: widget.radioId,
      name: widget.name,
    });

    await waitForRadioPreviewReady(page);
    await expect(page.getByTestId("editor-radio-preview")).toBeVisible();
    await expect(page.getByTestId("radio-sim-preview")).toHaveAttribute(
      "data-sim-phase",
      "running",
    );

    const baseline = await readRadioPreviewBitmap(page);
    expect(baseline.width).toBeGreaterThan(40);
    expect(baseline.height).toBeGreaterThan(40);

    const mark = await markRadioPreviewCanvas(page);

    // Watch for soft-restart UI while we mutate source (awaited loop so ticks
    // cannot overlap or push after the assertion).
    const updatingSeen: string[] = [];
    const watchState = { active: true };
    const updatingWatcher = page.getByTestId("radio-sim-updating");
    const softRestartWatch = (async () => {
      while (watchState.active) {
        try {
          const [updatingVisible, running] = await Promise.all([
            updatingWatcher.isVisible(),
            radioSimPhaseIsRunning(page),
          ]);
          if (updatingVisible) updatingSeen.push("updating-badge");
          if (!running) updatingSeen.push("phase-not-running");
        } catch {
          // Page may close at teardown — stop quietly.
          break;
        }
        await page.waitForTimeout(100);
      }
    })();

    try {
      await importLuaInEditor(page, HOT_RELOAD_ALT_LUA);

      const { metrics } = await waitForRadioPreviewChange(page, baseline, {
        timeoutMs: 25_000,
        // Orange/red board vs dark E2E dash should be a large MAE.
        minMae: 20,
      });

      await test.info().attach("hot-reload-metrics.json", {
        body: JSON.stringify(metrics, null, 2),
        contentType: "application/json",
      });

      expect(
        metrics.mae,
        `expected visible pixel change after hot-reload import (mae=${metrics.mae})`,
      ).toBeGreaterThanOrEqual(20);

      // Canvas node survived — soft-restart would remount and drop the mark.
      expect(await radioPreviewMarkStillPresent(page, mark)).toBe(true);
      await expect(page.getByTestId("radio-sim-preview")).toHaveAttribute(
        "data-sim-phase",
        "running",
      );
      await expect(page.getByTestId("radio-sim-updating")).toBeHidden();
    } finally {
      watchState.active = false;
      await softRestartWatch;
    }

    expect(
      updatingSeen,
      `soft-restart observed during hot-reload: ${updatingSeen.join(", ")}`,
    ).toEqual([]);
  });

  test("property color change hot-reloads without Updating badge", async ({
    page,
    request,
  }) => {
    const widget = await seedValidWidget(request, {
      source: VALID_MINIMAL_LUA,
      name: "E2EDash",
    });
    await gotoEditor(page, {
      instanceId: widget.workspaceKey,
      protocol: widget.protocol,
      radioId: widget.radioId,
      name: widget.name,
    });

    await waitForRadioPreviewReady(page);
    const baseline = await readRadioPreviewBitmap(page);
    const mark = await markRadioPreviewCanvas(page);

    // Select the title text layer (recordLayerLabel uses the drawText value).
    const textLayer = page
      .locator("[data-layer-id]")
      .filter({ hasText: /E2E\s*Dash/i })
      .first();
    await expect(textLayer).toBeVisible({ timeout: 15_000 });
    await textLayer.click();

    // Properties panel Color <select> includes many options in its accessible
    // name — match by option value rather than /^Color$/.
    const colorSelect = page
      .locator("select")
      .filter({ has: page.locator('option[value="ORANGE"]') })
      .last();
    await expect(colorSelect).toBeVisible({ timeout: 10_000 });
    await colorSelect.selectOption("ORANGE");

    const { metrics } = await waitForRadioPreviewChange(page, baseline, {
      timeoutMs: 20_000,
      // Single text color change is subtler than a full board swap.
      minMae: 1.5,
    });

    expect(metrics.mae).toBeGreaterThanOrEqual(1.5);
    expect(await radioPreviewMarkStillPresent(page, mark)).toBe(true);
    await expect(page.getByTestId("radio-sim-updating")).toBeHidden();
    await expect(page.getByTestId("radio-sim-preview")).toHaveAttribute(
      "data-sim-phase",
      "running",
    );
  });
});
