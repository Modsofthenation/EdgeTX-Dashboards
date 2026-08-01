import { test, expect } from "@playwright/test";
import { createChat } from "../helpers/api.ts";
import { gotoHome } from "../helpers/ui.ts";

test.describe("Chat history UI", () => {
  test("sidebar lists chats created via API after refresh", async ({
    page,
    request,
  }) => {
    const title = `Sidebar chat ${Date.now()}`;
    const chat = await createChat(request, { title });

    await gotoHome(page);
    // Expand chats panel if collapsed
    const chatsToggle = page.getByRole("button", { name: /Chats/i });
    if (await chatsToggle.isVisible().catch(() => false)) {
      const expanded = await page
        .getByText(title)
        .isVisible()
        .catch(() => false);
      if (!expanded) {
        await chatsToggle.click();
      }
    }

    await expect(page.getByText(title).first()).toBeVisible({
      timeout: 15_000,
    });

    // Selecting chat should update URL
    await page.getByText(title).first().click();
    await expect(page).toHaveURL(new RegExp(`chatId=${chat.id}`));
  });

  test("New chat clears URL chatId", async ({ page, request }) => {
    const chat = await createChat(request, {
      title: `Clearable ${Date.now()}`,
    });
    await gotoHome(page);
    await page.goto(`/?chatId=${encodeURIComponent(chat.id)}`);
    await expect(page).toHaveURL(new RegExp(`chatId=${chat.id}`));

    await page.getByRole("button", { name: "New chat" }).click();
    await expect(page).not.toHaveURL(/chatId=/);
    await expect(
      page.getByRole("heading", { name: "What should your dashboard show?" }),
    ).toBeVisible();
  });

  test("deleting a chat removes it from the list", async ({
    page,
    request,
  }) => {
    const title = `Delete me ${Date.now()}`;
    const chat = await createChat(request, { title });
    await gotoHome(page);

    const chatsToggle = page.getByRole("button", { name: /Chats/i });
    if (await chatsToggle.isVisible().catch(() => false)) {
      const visible = await page
        .getByText(title)
        .isVisible()
        .catch(() => false);
      if (!visible) await chatsToggle.click();
    }

    await expect(page.getByText(title).first()).toBeVisible();

    await page.getByRole("button", { name: `Delete ${title}` }).click();
    await page.getByRole("button", { name: "Delete" }).click();

    await expect(page.getByText(title)).toHaveCount(0, { timeout: 15_000 });
  });
});
