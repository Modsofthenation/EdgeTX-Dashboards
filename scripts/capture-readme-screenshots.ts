/**
 * Capture README marketing screenshots against a running next dev server.
 * Usage: E2E_BASE_URL=http://127.0.0.1:3000 npx tsx scripts/capture-readme-screenshots.ts
 *
 * Captures every primary app surface in every UI theme.
 */
import { chromium, type Page } from "@playwright/test";
import path from "node:path";
import { mkdirSync } from "node:fs";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const outDir = path.join(process.cwd(), "docs", "screenshots");
mkdirSync(outDir, { recursive: true });

/** Keep in sync with apps/web/src/lib/theme/themes.ts THEME_IDS */
const THEMES = [
  "light",
  "dark",
  "midnight",
  "slate",
  "forest",
  "ocean",
  "contrast",
  "graphite",
  "meadow",
  "fog",
  "ember",
  "volt",
  "copper",
  "aurora",
  "sunset",
  "prism",
  "flare",
  "citrus",
  "candy",
] as const;

type ThemeId = (typeof THEMES)[number];

const SURFACES = [
  {
    id: "home",
    path: "/",
    wait: async (page: Page) => {
      await page.getByText("Recent projects").waitFor({ timeout: 30_000 });
    },
  },
  {
    id: "studio",
    path: "/studio",
    wait: async (page: Page) => {
      await page
        .getByRole("heading", { name: "What should your dashboard show?" })
        .waitFor({ timeout: 30_000 });
    },
  },
  {
    id: "templates",
    path: "/templates",
    wait: async (page: Page) => {
      await page
        .getByRole("group", { name: "Filter by protocol" })
        .waitFor({ timeout: 30_000 });
    },
  },
  {
    id: "editor",
    path: "/editor?template=whoop&protocol=betaflight&radioId=tx15",
    wait: async (page: Page) => {
      await page
        .getByRole("button", { name: "Insert" })
        .waitFor({ timeout: 45_000 });
      // Approximate parser preview shows the whoop board reliably for marketing
      // shots; WASM radio preview often boots on EdgeTX chrome / recovery UI.
      await ensureApproximatePreview(page);
      await page
        .getByTestId("editor-parser-preview")
        .waitFor({ timeout: 15_000 });
      await page.waitForTimeout(400);
    },
  },
  {
    id: "settings",
    path: "/settings?tab=appearance",
    wait: async (page: Page) => {
      await page.locator("[data-theme-preview]").first().waitFor({
        timeout: 30_000,
      });
    },
  },
] as const;

async function dismissWizard(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("edgetx.firstRunWizard.dismissed.v1", "1");
    } catch {
      /* ignore */
    }
  });
}

async function setTheme(page: Page, theme: ThemeId) {
  await page.evaluate((t) => {
    localStorage.setItem("etx-dashboards-theme", t);
    document.documentElement.dataset.theme = t;
  }, theme);
}

async function ensureApproximatePreview(page: Page) {
  const label = page.getByTestId("editor-preview-mode-label");
  await label.waitFor({ state: "visible", timeout: 30_000 });
  const text = (await label.textContent()) ?? "";
  if (/Approximate/i.test(text)) return;
  await page.getByRole("button", { name: "View" }).click();
  await page
    .getByRole("menuitem", { name: /Hide radio preview/i })
    .waitFor({ state: "visible", timeout: 10_000 });
  await page.getByRole("menuitem", { name: /Hide radio preview/i }).click();
  await page.waitForFunction(
    () => {
      const mode = document
        .querySelector('[data-testid="editor-canvas-frame"]')
        ?.getAttribute("data-preview-mode");
      return mode === "approximate";
    },
    { timeout: 15_000 },
  );
}

/** Open Insert and scroll to section prefabs (below primitives). */
async function openInsertPrefabMenu(page: Page) {
  await page.getByRole("button", { name: "Insert" }).click();
  const menu = page.getByRole("menu");
  await menu.waitFor({ state: "visible", timeout: 10_000 });
  const whoop = menu.getByRole("menuitem", { name: /Full whoop board/i });
  await whoop.scrollIntoViewIfNeeded();
  await whoop.waitFor({ state: "visible", timeout: 5_000 });
  await page.waitForTimeout(300);
}

async function gotoSurface(
  page: Page,
  surface: (typeof SURFACES)[number],
  theme: ThemeId,
) {
  await page.goto(`${baseURL}${surface.path}`);
  await page.getByRole("navigation", { name: "Primary" }).waitFor({
    timeout: 30_000,
  });
  await setTheme(page, theme);
  await page.reload();
  await page.getByRole("navigation", { name: "Primary" }).waitFor({
    timeout: 30_000,
  });
  await surface.wait(page);
}

async function shot(page: Page, name: string) {
  await page.screenshot({
    path: path.join(outDir, name),
    fullPage: false,
  });
  console.log(`  wrote ${name}`);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
  });
  await dismissWizard(page);

  console.log(
    `Capturing ${SURFACES.length} surfaces × ${THEMES.length} themes`,
  );

  for (const surface of SURFACES) {
    console.log(`\n[${surface.id}]`);
    for (const theme of THEMES) {
      await gotoSurface(page, surface, theme);
      await shot(page, `readme-${surface.id}-${theme}.png`);
    }
  }

  // Insert prefabs overlay (dark + a couple accent themes)
  console.log("\n[insert]");
  for (const theme of ["dark", "light", "ember", "volt", "candy"] as const) {
    await gotoSurface(
      page,
      SURFACES.find((s) => s.id === "editor")!,
      theme,
    );
    await openInsertPrefabMenu(page);
    await shot(page, `readme-insert-${theme}.png`);
    await page.keyboard.press("Escape");
  }
  // Keep legacy filename used by older README sections
  await gotoSurface(
    page,
    SURFACES.find((s) => s.id === "editor")!,
    "dark",
  );
  await openInsertPrefabMenu(page);
  await shot(page, "readme-insert-prefabs.png");

  // Simulator overlay (do not Escape — that closes the modal)
  console.log("\n[sim]");
  for (const theme of ["dark", "light", "midnight", "volt"] as const) {
    await gotoSurface(
      page,
      SURFACES.find((s) => s.id === "editor")!,
      theme,
    );
    await page.getByRole("button", { name: "Simulator" }).click();
    await page
      .getByRole("heading", { name: "Run in simulator" })
      .waitFor({ timeout: 20_000 });
    await page
      .getByTestId("radio-sim-preview")
      .waitFor({ timeout: 60_000 })
      .catch(() => undefined);
    // Pulse fullscreen tap a few times; ignore if still on EdgeTX chrome.
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => {
        window.__edgetxEnterWidgetFullscreen?.();
      });
      await page.waitForTimeout(900);
    }
    await shot(page, `readme-sim-${theme}.png`);
    await page.getByRole("button", { name: "Done" }).click();
    await page.waitForTimeout(400);
  }
  // Legacy filename
  await gotoSurface(
    page,
    SURFACES.find((s) => s.id === "editor")!,
    "dark",
  );
  await page.getByRole("button", { name: "Simulator" }).click();
  await page
    .getByRole("heading", { name: "Run in simulator" })
    .waitFor({ timeout: 20_000 });
  await page
    .getByTestId("radio-sim-preview")
    .waitFor({ timeout: 60_000 })
    .catch(() => undefined);
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => {
      window.__edgetxEnterWidgetFullscreen?.();
    });
    await page.waitForTimeout(900);
  }
  await shot(page, "readme-sim.png");

  // Settings AI + Simulator tabs (representative)
  console.log("\n[settings-tabs]");
  await page.goto(`${baseURL}/settings?tab=ai`);
  await setTheme(page, "dark");
  await page.reload();
  await page.getByRole("heading", { name: "AI providers" }).waitFor({
    timeout: 15_000,
  });
  await shot(page, "readme-settings-ai-dark.png");

  await page.goto(`${baseURL}/settings?tab=simulator`);
  await setTheme(page, "dark");
  await page.reload();
  await page
    .getByRole("heading", { name: "Simulator", exact: true })
    .waitFor({ timeout: 15_000 });
  await shot(page, "readme-settings-simulator-dark.png");

  // Legacy settings appearance filename
  await gotoSurface(
    page,
    SURFACES.find((s) => s.id === "settings")!,
    "dark",
  );
  await shot(page, "readme-settings-themes.png");

  console.log(`\nWrote screenshots to ${outDir}`);
  console.log(`Themes covered: ${THEMES.join(", ")}`);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
