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

export async function gotoEditor(
  page: Page,
  query: Record<string, string> = {},
): Promise<void> {
  await dismissFirstRunWizard(page);
  const qs = new URLSearchParams(query).toString();
  await page.goto(qs ? `/editor?${qs}` : "/editor");
  await page.getByRole("navigation", { name: "Primary" }).waitFor();
}

export async function openPreferences(
  page: Page,
  tab?: "Appearance" | "AI" | "Simulator WASM",
): Promise<void> {
  await page.getByRole("button", { name: "Preferences" }).click();
  const dialog = page.getByRole("dialog", { name: "Preferences" });
  await dialog.waitFor();
  if (tab) {
    await dialog.getByRole("tab", { name: tab }).click();
  }
}

export async function closePreferences(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog", { name: "Preferences" });
  if (await dialog.isVisible().catch(() => false)) {
    await dialog.getByRole("button", { name: "Close" }).click();
  }
}
