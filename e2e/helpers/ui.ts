import type { Page } from "@playwright/test";

export const FIRST_RUN_DISMISS_KEY = "edgetx.firstRunWizard.dismissed.v1";

/** Dismiss the first-run wizard before hydration opens it. */
export async function dismissFirstRunWizard(page: Page): Promise<void> {
  await page.addInitScript((key: string) => {
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
  }, FIRST_RUN_DISMISS_KEY);
}

export async function gotoHome(page: Page): Promise<void> {
  await dismissFirstRunWizard(page);
  await page.goto("/");
  await page.getByRole("navigation", { name: "Primary" }).waitFor();
}

export async function gotoStudio(
  page: Page,
  query: Record<string, string> = {},
): Promise<void> {
  await dismissFirstRunWizard(page);
  const qs = new URLSearchParams(query).toString();
  await page.goto(qs ? `/studio?${qs}` : "/studio");
  await page.getByRole("navigation", { name: "Primary" }).waitFor();
}

export async function gotoEditor(
  page: Page,
  query: Record<string, string> = {},
): Promise<void> {
  await dismissFirstRunWizard(page);
  const qs = new URLSearchParams(query).toString();
  await page.goto(qs ? `/editor?${qs}` : "/editor");
  await page.getByRole("navigation", { name: "Primary" }).waitFor();
}

export async function gotoTemplates(page: Page): Promise<void> {
  await dismissFirstRunWizard(page);
  await page.goto("/templates");
  await page.getByRole("navigation", { name: "Primary" }).waitFor();
}

export async function gotoSettings(
  page: Page,
  tab?: "appearance" | "ai" | "simulator" | "defaults",
): Promise<void> {
  await dismissFirstRunWizard(page);
  const qs = tab ? `?tab=${tab}` : "?tab=appearance";
  await page.goto(`/settings${qs}`);
  await page.getByRole("navigation", { name: "Primary" }).waitFor();
}

/** Primary chrome nav link (exact). */
export function primaryNavLink(
  page: Page,
  name: "Home" | "Studio" | "Editor" | "Templates" | "Settings",
) {
  return page.getByRole("navigation", { name: "Primary" }).getByRole("link", {
    name,
    exact: true,
  });
}

export async function ensureChatsPanelOpen(page: Page): Promise<void> {
  const show = page.getByRole("button", { name: "Show Chats panel" });
  if (await show.isVisible().catch(() => false)) {
    await show.click();
  }
  await page.getByRole("heading", { name: "Chats" }).waitFor({
    state: "visible",
    timeout: 10_000,
  });
}

export async function openSettings(
  page: Page,
  tab?: "Appearance" | "AI providers" | "Simulator" | "Defaults",
): Promise<void> {
  await page
    .getByRole("link", { name: "Settings", exact: true })
    .first()
    .click();
  await expectSettingsPage(page);
  if (tab) {
    await page
      .getByRole("navigation", { name: "Settings sections" })
      .getByRole("button", { name: tab })
      .click();
  }
}

async function expectSettingsPage(page: Page): Promise<void> {
  await page.waitForURL(/\/settings/);
  await page
    .getByRole("heading", { name: /Appearance|AI|Simulator|Defaults/i })
    .waitFor();
}

/** @deprecated Use openSettings — Preferences modal was replaced by /settings. */
export async function openPreferences(
  page: Page,
  tab?: "Appearance" | "AI" | "Simulator WASM",
): Promise<void> {
  const map = {
    Appearance: "Appearance",
    AI: "AI providers",
    "Simulator WASM": "Simulator",
  } as const;
  await openSettings(page, tab ? map[tab] : "Appearance");
}

export async function closePreferences(page: Page): Promise<void> {
  // Settings is a page now — navigate home to leave it.
  if (page.url().includes("/settings")) {
    await page.goto("/");
  }
}
