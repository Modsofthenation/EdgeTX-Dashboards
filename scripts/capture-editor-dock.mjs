import { chromium } from "@playwright/test";

const base = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const out = "/opt/cursor/artifacts/screenshots/editor-canvas-dock.png";
const outClose =
  "/opt/cursor/artifacts/screenshots/editor-canvas-dock-closeup.png";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
  });
  await page.addInitScript(() => {
    try {
      localStorage.setItem("edgetx.firstRunWizard.dismissed.v1", "1");
      localStorage.setItem("etx-dashboards-theme", "dark");
    } catch {
      /* ignore */
    }
  });
  await page.goto(
    `${base}/editor?template=whoop&protocol=betaflight&radioId=tx15`,
  );
  await page
    .getByRole("button", { name: "Insert" })
    .waitFor({ timeout: 45_000 });
  await page.getByTestId("editor-canvas-meta").waitFor({ timeout: 15_000 });
  await page.waitForTimeout(1500);

  try {
    const mode = await page
      .getByTestId("editor-preview-mode-label")
      .textContent();
    if (mode && /Radio preview/i.test(mode)) {
      await page.getByRole("button", { name: "View" }).click();
      const hide = page.getByRole("menuitem", {
        name: /Hide radio preview/i,
      });
      if (await hide.isVisible().catch(() => false)) {
        await hide.click();
      } else {
        await page.keyboard.press("Escape");
      }
    }
  } catch {
    /* ignore */
  }
  await page.waitForTimeout(900);

  const dock = page.getByTestId("editor-canvas-meta");
  await dock.scrollIntoViewIfNeeded();
  await page.screenshot({ path: out, fullPage: false });
  const box = await dock.boundingBox();
  if (box) {
    await page.screenshot({
      path: outClose,
      clip: {
        x: Math.max(0, box.x - 32),
        y: Math.max(0, box.y - 32),
        width: Math.min(1440 - Math.max(0, box.x - 32), box.width + 64),
        height: Math.min(260, box.height + 64),
      },
    });
  }
  console.log("wrote", out);
  console.log("wrote", outClose, "box", box);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
