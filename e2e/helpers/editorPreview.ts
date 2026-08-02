import type { Page } from "@playwright/test";
import {
  assertFidelityGates,
  compareRgbaBitmaps,
  type PreviewCompareMetrics,
  type RgbaBitmap,
} from "./previewCompare.ts";

export type CapturedPreviewPair = {
  radio: RgbaBitmap;
  approximate: RgbaBitmap;
  metrics: PreviewCompareMetrics;
  gateFailures: string[];
};

export async function readRadioPreviewBitmap(page: Page): Promise<RgbaBitmap> {
  return readCanvasBitmap(page, "editor-radio-preview");
}

async function readCanvasBitmap(
  page: Page,
  testId: string,
  options: { cropToContent?: boolean } = {},
): Promise<RgbaBitmap> {
  return page.evaluate(
    ({ id, cropToContent }) => {
      const canvas = document.querySelector(
        `[data-testid="${id}"]`,
      ) as HTMLCanvasElement | null;
      if (!canvas) throw new Error(`canvas not found: ${id}`);
      if (canvas.width < 8 || canvas.height < 8) {
        throw new Error(
          `canvas too small: ${id} ${canvas.width}x${canvas.height}`,
        );
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error(`2d context missing: ${id}`);

      let sx = 0;
      let sy = 0;
      let sw = canvas.width;
      let sh = canvas.height;
      if (cropToContent) {
        const cx = Number(canvas.dataset.contentX ?? "0");
        const cy = Number(canvas.dataset.contentY ?? "0");
        const cw = Number(canvas.dataset.contentW ?? "0");
        const ch = Number(canvas.dataset.contentH ?? "0");
        if (cw > 0 && ch > 0) {
          sx = Math.max(0, Math.round(cx));
          sy = Math.max(0, Math.round(cy));
          sw = Math.min(canvas.width - sx, Math.round(cw));
          sh = Math.min(canvas.height - sy, Math.round(ch));
        }
      }

      const image = ctx.getImageData(sx, sy, sw, sh);
      return {
        width: sw,
        height: sh,
        data: Array.from(image.data),
      };
    },
    { id: testId, cropToContent: Boolean(options.cropToContent) },
  );
}

async function clickViewMenuItem(page: Page, name: RegExp): Promise<void> {
  await page.getByRole("button", { name: "View" }).click();
  const item = page.getByRole("menuitem", { name });
  await item.waitFor({ state: "visible", timeout: 10_000 });
  await item.click();
}

/** True when the top strip looks like EdgeTX theme chrome (blue bar), not a black widget clear. */
function topStripLooksLikeRadioChrome(bmp: RgbaBitmap): boolean {
  const h = Math.min(24, Math.floor(bmp.height * 0.1));
  if (h < 4) return false;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < bmp.width; x += 4) {
      const i = (y * bmp.width + x) * 4;
      sumR += bmp.data[i]!;
      sumG += bmp.data[i + 1]!;
      sumB += bmp.data[i + 2]!;
      n++;
    }
  }
  if (n === 0) return false;
  const r = sumR / n;
  const g = sumG / n;
  const b = sumB / n;
  // Stock theme focus/secondary blues sit well above a black/dark dashboard header.
  return b > 70 && b > r + 25 && b > g + 10;
}

/** Wait until inline radio preview has painted a non-trivial frame. */
export async function waitForRadioPreviewReady(
  page: Page,
  timeoutMs = 90_000,
): Promise<void> {
  await page.getByTestId("editor-preview-mode-label").waitFor({
    state: "visible",
    timeout: 15_000,
  });

  const label = page.getByTestId("editor-preview-mode-label");
  const text = await label.textContent();
  if (text && /Approximate/i.test(text)) {
    await clickViewMenuItem(page, /Show radio preview/i);
  }

  await page
    .waitForFunction(
      () => {
        const bodyText = document.body?.innerText ?? "";
        if (
          /WebAssembly\.instantiate|simuAuxSerialStart|worker crashed|firmware may still be downloading/i.test(
            bodyText,
          )
        ) {
          return "sim-error";
        }
        const mode = document
          .querySelector('[data-testid="editor-canvas-frame"]')
          ?.getAttribute("data-preview-mode");
        if (mode !== "radio") return false;
        const canvas = document.querySelector(
          '[data-testid="editor-radio-preview"]',
        ) as HTMLCanvasElement | null;
        if (!canvas || canvas.width < 8 || canvas.height < 8) return false;
        const ctx = canvas.getContext("2d");
        if (!ctx) return false;
        const { data, width, height } = ctx.getImageData(
          0,
          0,
          canvas.width,
          canvas.height,
        );
        let lit = 0;
        const step = 16;
        for (let y = 0; y < height; y += step) {
          for (let x = 0; x < width; x += step) {
            const i = (y * width + x) * 4;
            if (data[i]! > 20 || data[i + 1]! > 20 || data[i + 2]! > 20) lit++;
          }
        }
        return lit > 8 ? "ready" : false;
      },
      { timeout: Math.min(timeoutMs, 45_000) },
    )
    .then((result) => {
      if (result === "sim-error") {
        throw new Error(
          "Radio WASM preview failed to boot (firmware/worker error). Run npm run setup:sim / sync-wasm.",
        );
      }
    });

  // Replay fullscreen until top chrome disappears (or attempts exhausted).
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    await page.evaluate(() => {
      window.__edgetxEnterWidgetFullscreen?.();
    });
    await page.waitForTimeout(1800);
    const frame = await readCanvasBitmap(page, "editor-radio-preview");
    if (!topStripLooksLikeRadioChrome(frame)) return;
  }
}

export async function setRadioPreview(
  page: Page,
  enabled: boolean,
): Promise<void> {
  const label = page.getByTestId("editor-preview-mode-label");
  await label.waitFor({ state: "visible", timeout: 15_000 });
  const text = (await label.textContent()) ?? "";
  const isRadio = /Radio preview|Editing overlay/i.test(text);
  if (enabled === isRadio) return;

  if (enabled) {
    await clickViewMenuItem(page, /Show radio preview/i);
  } else {
    await clickViewMenuItem(page, /Hide radio preview/i);
  }

  await page.waitForFunction(
    (wantRadio) => {
      const mode = document
        .querySelector('[data-testid="editor-canvas-frame"]')
        ?.getAttribute("data-preview-mode");
      return wantRadio ? mode === "radio" : mode === "approximate";
    },
    enabled,
    { timeout: 15_000 },
  );
}

/**
 * Capture radio WASM pixels, then approximate parser pixels, and score them.
 */
export async function capturePreviewPair(
  page: Page,
): Promise<CapturedPreviewPair> {
  await waitForRadioPreviewReady(page);
  const radio = await readCanvasBitmap(page, "editor-radio-preview");

  await setRadioPreview(page, false);
  await page.getByTestId("editor-parser-preview").waitFor({
    state: "visible",
    timeout: 15_000,
  });
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector(
        '[data-testid="editor-parser-preview"]',
      ) as HTMLCanvasElement | null;
      if (!canvas || canvas.width < 8 || canvas.height < 8) return false;
      const ctx = canvas.getContext("2d");
      if (!ctx) return false;
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < data.length; i += 4 * 37) {
        if (data[i]! > 4 || data[i + 1]! > 4 || data[i + 2]! > 4) return true;
      }
      return false;
    },
    { timeout: 5_000 },
  );
  const approximate = await readCanvasBitmap(page, "editor-parser-preview", {
    cropToContent: true,
  });

  const metrics = compareRgbaBitmaps(radio, approximate, {
    maskTopPx: Math.round(Math.min(radio.height, approximate.height) * 0.08),
  });
  const gateFailures = assertFidelityGates(metrics);
  return { radio, approximate, metrics, gateFailures };
}

const HOT_RELOAD_MARK = "data-e2e-hot-reload-mark";

/** Stamp the radio canvas so we can detect remounts (soft-restart). */
export async function markRadioPreviewCanvas(page: Page): Promise<string> {
  const token = `hot-${Date.now()}`;
  await page.evaluate(
    ({ mark, token: t }) => {
      const canvas = document.querySelector(
        '[data-testid="editor-radio-preview"]',
      );
      if (!canvas) throw new Error("editor-radio-preview canvas missing");
      canvas.setAttribute(mark, t);
    },
    { mark: HOT_RELOAD_MARK, token },
  );
  return token;
}

export async function radioPreviewMarkStillPresent(
  page: Page,
  token: string,
): Promise<boolean> {
  return page.evaluate(
    ({ mark, token: t }) => {
      const canvas = document.querySelector(
        '[data-testid="editor-radio-preview"]',
      );
      return canvas?.getAttribute(mark) === t;
    },
    { mark: HOT_RELOAD_MARK, token },
  );
}

/** True when the inline sim root reports phase=running (no boot flash). */
export async function radioSimPhaseIsRunning(page: Page): Promise<boolean> {
  const host = page.getByTestId("radio-sim-preview");
  if ((await host.count()) === 0) return false;
  return (await host.getAttribute("data-sim-phase")) === "running";
}

/**
 * Wait until the radio preview bitmap differs meaningfully from `baseline`.
 * Returns the new bitmap + compare metrics.
 */
export async function waitForRadioPreviewChange(
  page: Page,
  baseline: RgbaBitmap,
  options: { timeoutMs?: number; minMae?: number } = {},
): Promise<{ bitmap: RgbaBitmap; metrics: PreviewCompareMetrics }> {
  const timeoutMs = options.timeoutMs ?? 20_000;
  const minMae = options.minMae ?? 12;
  const deadline = Date.now() + timeoutMs;
  let last: RgbaBitmap = baseline;
  let lastMetrics: PreviewCompareMetrics | null = null;

  while (Date.now() < deadline) {
    last = await readRadioPreviewBitmap(page);
    lastMetrics = compareRgbaBitmaps(baseline, last);
    if (lastMetrics.mae >= minMae) {
      return { bitmap: last, metrics: lastMetrics };
    }
    await page.waitForTimeout(200);
  }

  throw new Error(
    `Radio preview did not change within ${timeoutMs}ms (mae=${lastMetrics?.mae ?? 0}, need >= ${minMae})`,
  );
}

/** Import Lua via More → Import Lua… (replaces editor source). */
export async function importLuaInEditor(
  page: Page,
  source: string,
): Promise<void> {
  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("menuitem", { name: /Import Lua/i }).click();
  const dialog = page.getByRole("dialog", { name: /Import Lua/i });
  await dialog.waitFor({ state: "visible", timeout: 10_000 });
  await dialog.locator("textarea").fill(source);
  await dialog.getByRole("button", { name: /^Import$/i }).click();
  await dialog.waitFor({ state: "hidden", timeout: 10_000 });
}
