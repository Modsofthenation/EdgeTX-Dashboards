import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { seedValidWidget, postJson } from "../helpers/api.ts";
import { gotoEditor } from "../helpers/ui.ts";
import {
  capturePreviewPair,
  setRadioPreview,
  waitForRadioPreviewReady,
} from "../helpers/editorPreview.ts";
import { assertSoftFidelity } from "../helpers/previewCompare.ts";
import { VALID_MINIMAL_LUA } from "../helpers/lua-fixtures.ts";

const ROOT = join(__dirname, "..", "..");
const EXAMPLES_DIR = join(ROOT, "examples");

const EXAMPLE_FILES = readdirSync(EXAMPLES_DIR)
  .filter((f) => f.endsWith(".lua"))
  .sort();

const TEMPLATE_BOARDS = [
  "minimal-quad",
  "whoop",
  "dense-crsf",
  "freestyle-quad",
  "starter",
] as const;

function softFidelityExpectors(testInfo: {
  annotations: { type: string; description?: string }[];
}) {
  return {
    annotate: (notice: string) => {
      testInfo.annotations.push({ type: "notice", description: notice });
    },
    expectEqual: (actual: unknown, expected: unknown, message?: string) => {
      expect(actual, message).toEqual(expected);
    },
    expectLessThan: (actual: number, bound: number) => {
      expect(actual).toBeLessThan(bound);
    },
    expectGreaterThan: (actual: number, bound: number) => {
      expect(actual).toBeGreaterThan(bound);
    },
  };
}

test.describe("Editor ↔ WASM preview fidelity", () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeAll(async ({ request }) => {
    const res = await request.get("/api/sim-firmware");
    if (!res.ok()) {
      throw new Error(
        `sim-firmware probe failed (${res.status()}) — is the web app running?`,
      );
    }
    const body = (await res.json()) as { ready?: boolean };
    test.skip(
      !body.ready,
      "WASM firmware not synced — run npm run sync-wasm first",
    );
  });

  test("defaults to radio preview on TX15", async ({ page }) => {
    await gotoEditor(page, { protocol: "betaflight", radioId: "tx15" });
    await expect(page.getByTestId("editor-preview-mode-label")).toHaveText(
      /Radio preview|Editing overlay/,
      { timeout: 30_000 },
    );
  });

  test("View menu toggles approximate ↔ radio preview", async ({
    page,
    request,
  }) => {
    const widget = await seedValidWidget(request, {
      source: VALID_MINIMAL_LUA,
    });
    await gotoEditor(page, {
      instanceId: widget.workspaceKey,
      protocol: widget.protocol,
      radioId: widget.radioId,
    });

    await waitForRadioPreviewReady(page);
    await expect(page.getByTestId("editor-radio-preview")).toBeVisible();

    await setRadioPreview(page, false);
    await expect(page.getByTestId("editor-preview-mode-label")).toHaveText(
      /Approximate preview/,
    );
    await expect(page.getByTestId("editor-parser-preview")).toBeVisible();

    await setRadioPreview(page, true);
    await waitForRadioPreviewReady(page);
    await expect(page.getByTestId("editor-preview-mode-label")).toHaveText(
      /Radio preview/,
    );
  });

  test("minimal seeded dashboard paints both radio and approximate previews", async ({
    page,
    request,
  }) => {
    const widget = await seedValidWidget(request, {
      source: VALID_MINIMAL_LUA,
    });
    await gotoEditor(page, {
      instanceId: widget.workspaceKey,
      protocol: widget.protocol,
      radioId: widget.radioId,
      name: widget.name,
    });

    const pair = await capturePreviewPair(page);
    await test.info().attach("fidelity-metrics.json", {
      body: JSON.stringify(pair.metrics, null, 2),
      contentType: "application/json",
    });

    expect(pair.radio.width).toBeGreaterThan(40);
    expect(pair.approximate.width).toBeGreaterThan(40);
    expect(pair.metrics.coverageA).toBeGreaterThan(0.05);
    expect(pair.metrics.coverageB).toBeGreaterThan(0.05);

    // Soft pixel gate: only enforce when WASM left radio chrome (widget fullscreen).
    // Headless double-tap fullscreen is firmware-dependent; still record metrics.
    assertSoftFidelity(pair, {
      ...softFidelityExpectors(test.info()),
      enforceWhen: { maxMae: 100, maxCoverageDelta: 0.35 },
      softFallback: { maxMae: 200, minCoverageB: 0.08 },
    });
  });

  for (const file of EXAMPLE_FILES) {
    test(`example ${file}: editor loads + dual preview paints`, async ({
      page,
      request,
    }) => {
      const source = readFileSync(join(EXAMPLES_DIR, file), "utf8");
      const protocol = /rotorflight/i.test(file) ? "rotorflight" : "betaflight";
      const widget = await seedValidWidget(request, {
        source,
        protocol,
        name: file
          .replace(/\.lua$/, "")
          .replace(/^tx15-/, "")
          .slice(0, 10),
      });

      const { status, body } = await postJson<{
        valid?: boolean;
        issues?: { severity: string; message: string }[];
      }>(request, "/api/validate", {
        source,
        protocol,
        radioId: "tx15",
      });
      expect(status).toBe(200);
      expect(
        body.valid,
        `${file} validate failed: ${JSON.stringify(body.issues?.slice(0, 3))}`,
      ).toBe(true);

      await gotoEditor(page, {
        instanceId: widget.workspaceKey,
        protocol: widget.protocol,
        radioId: widget.radioId,
        name: widget.name,
      });

      await expect
        .poll(async () => page.locator("[data-layer-id]").count(), {
          timeout: 30_000,
        })
        .toBeGreaterThan(0);

      const pair = await capturePreviewPair(page);
      await test.info().attach(`${file}-metrics.json`, {
        body: JSON.stringify(
          { file, metrics: pair.metrics, gateFailures: pair.gateFailures },
          null,
          2,
        ),
        contentType: "application/json",
      });

      expect(pair.metrics.coverageA).toBeGreaterThan(0.02);
      // Sparse text-only boards (hero-minimal) legitimately have tiny coverage.
      expect(pair.metrics.coverageB).toBeGreaterThan(0.002);
      expect(pair.radio.width).toBeGreaterThan(40);
      expect(pair.approximate.width).toBeGreaterThan(40);

      assertSoftFidelity(pair, {
        ...softFidelityExpectors(test.info()),
        label: file,
        enforceWhen: {
          maxMae: 70,
          maxCoverageDelta: 0.25,
          maxHardMismatch: 0.4,
        },
        softFallback: { maxMae: 210 },
        ignoreHistCorrelation: true,
      });
    });
  }

  for (const template of TEMPLATE_BOARDS) {
    test(`template ${template}: dual preview paints`, async ({ page }) => {
      await gotoEditor(page, {
        template,
        protocol: "betaflight",
        radioId: "tx15",
      });

      await expect
        .poll(async () => page.locator("[data-layer-id]").count(), {
          timeout: 30_000,
        })
        .toBeGreaterThan(0);

      const pair = await capturePreviewPair(page);
      await test.info().attach(`template-${template}-metrics.json`, {
        body: JSON.stringify(pair.metrics, null, 2),
        contentType: "application/json",
      });

      expect(pair.metrics.coverageA).toBeGreaterThan(0.02);
      expect(pair.metrics.coverageB).toBeGreaterThan(0.02);
      expect(pair.metrics.mae).toBeLessThan(210);
    });
  }

  test("Simulator modal paints EdgeTX pixels for seeded widget", async ({
    page,
    request,
  }) => {
    const widget = await seedValidWidget(request, {
      source: VALID_MINIMAL_LUA,
    });
    await gotoEditor(page, {
      instanceId: widget.workspaceKey,
      protocol: widget.protocol,
      radioId: widget.radioId,
    });

    await waitForRadioPreviewReady(page);
    await page.getByRole("button", { name: "Simulator" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(
      dialog
        .getByTestId("edgetx-widget-preview")
        .or(dialog.getByTestId("editor-radio-preview"))
        .or(dialog.getByLabel("EdgeTX widget preview")),
    ).toBeVisible({ timeout: 90_000 });
  });
});
