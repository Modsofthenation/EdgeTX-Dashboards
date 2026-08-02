/**
 * Capture README marketing screenshots against a running next dev server.
 * Usage: E2E_BASE_URL=http://127.0.0.1:3000 npx tsx scripts/capture-readme-screenshots.ts
 */
import { chromium } from "@playwright/test";
import path from "node:path";
import { mkdirSync } from "node:fs";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const outDir = path.join(process.cwd(), "docs", "screenshots");
mkdirSync(outDir, { recursive: true });

const THEMES = [
  "dark",
  "light",
  "ocean",
  "midnight",
  "forest",
  "slate",
  "ember",
] as const;

async function dismissWizard(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("edgetx.firstRunWizard.dismissed.v1", "1");
    } catch {
      /* ignore */
    }
  });
}

async function setTheme(page: import("@playwright/test").Page, theme: string) {
  await page.evaluate((t) => {
    localStorage.setItem("etx-dashboards-theme", t);
    document.documentElement.dataset.theme = t;
  }, theme);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
  });
  await dismissWizard(page);

  // Home library
  await page.goto(`${baseURL}/`);
  await page.getByRole("navigation", { name: "Primary" }).waitFor();
  await setTheme(page, "dark");
  await page.reload();
  await page.getByText("Recent projects").waitFor();
  await page.screenshot({
    path: path.join(outDir, "readme-home-dark.png"),
    fullPage: false,
  });

  await setTheme(page, "light");
  await page.reload();
  await page.getByText("Recent projects").waitFor();
  await page.screenshot({
    path: path.join(outDir, "readme-home-light.png"),
    fullPage: false,
  });

  // Studio
  for (const theme of [
    "dark",
    "ocean",
    "midnight",
    "light",
    "ember",
  ] as const) {
    await page.goto(`${baseURL}/studio`);
    await page.getByRole("navigation", { name: "Primary" }).waitFor();
    await setTheme(page, theme);
    await page.reload();
    await page
      .getByRole("heading", { name: "What should your dashboard show?" })
      .waitFor();
    await page.screenshot({
      path: path.join(outDir, `readme-studio-${theme}.png`),
      fullPage: false,
    });
  }

  // Templates
  await page.goto(`${baseURL}/templates`);
  await setTheme(page, "dark");
  await page.reload();
  await page.getByRole("group", { name: "Filter by protocol" }).waitFor();
  await page.screenshot({
    path: path.join(outDir, "readme-templates-dark.png"),
    fullPage: false,
  });

  // Settings themes
  await page.goto(`${baseURL}/settings?tab=appearance`);
  await setTheme(page, "dark");
  await page.reload();
  await page.locator("[data-theme-preview]").first().waitFor();
  await page.screenshot({
    path: path.join(outDir, "readme-settings-themes.png"),
    fullPage: false,
  });

  // Editor with whoop template
  await page.goto(
    `${baseURL}/editor?template=whoop&protocol=betaflight&radioId=tx15`,
  );
  await page
    .getByRole("button", { name: "Insert" })
    .waitFor({ timeout: 30_000 });
  for (const theme of [
    "dark",
    "forest",
    "midnight",
    "light",
    "slate",
  ] as const) {
    await setTheme(page, theme);
    await page.reload();
    await page
      .getByRole("button", { name: "Insert" })
      .waitFor({ timeout: 30_000 });
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(outDir, `readme-editor-${theme}.png`),
      fullPage: false,
    });
  }

  // Insert menu
  await setTheme(page, "dark");
  await page.reload();
  await page.getByRole("button", { name: "Insert" }).waitFor();
  await page.getByRole("button", { name: "Insert" }).click();
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(outDir, "readme-insert-prefabs.png"),
    fullPage: false,
  });

  // Simulator overlay
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Simulator" }).click();
  await page
    .getByRole("heading", { name: "Run in simulator" })
    .waitFor({ timeout: 15_000 });
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(outDir, "readme-sim.png"),
    fullPage: false,
  });

  console.log(`Wrote screenshots to ${outDir}`);
  console.log(`Themes covered: ${THEMES.join(", ")}`);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
