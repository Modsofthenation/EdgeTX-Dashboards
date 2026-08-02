import { test, expect } from "@playwright/test";
import { createChat } from "../helpers/api.ts";
import {
  dismissFirstRunWizard,
  ensureChatsPanelOpen,
  gotoStudio,
} from "../helpers/ui.ts";

test.describe("Chat history UI", () => {
  test("sidebar lists chats created via API after refresh", async ({
    page,
    request,
  }) => {
    const title = `Sidebar chat ${Date.now()}`;
    const chat = await createChat(request, { title });

    await gotoStudio(page);
    await ensureChatsPanelOpen(page);

    await expect(page.getByText(title).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.getByText(title).first().click();
    await expect(page).toHaveURL(
      (url) =>
        url.pathname.startsWith("/studio") &&
        url.searchParams.get("chatId") === chat.id,
    );
  });

  test("New chat clears URL chatId", async ({ page, request }) => {
    const chat = await createChat(request, {
      title: `Clearable ${Date.now()}`,
    });
    await dismissFirstRunWizard(page);
    await page.goto(`/studio?chatId=${encodeURIComponent(chat.id)}`);
    await expect(page).toHaveURL(
      (url) => url.searchParams.get("chatId") === chat.id,
    );

    await page.getByRole("button", { name: "New chat" }).click();
    await expect(page).not.toHaveURL(/chatId=/);
    await expect(
      page.getByRole("heading", { name: "What should your dashboard show?" }),
    ).toBeVisible();
  });

  test("legacy /?chatId= redirects to Studio", async ({ page, request }) => {
    const chat = await createChat(request, {
      title: `Legacy redirect ${Date.now()}`,
    });
    await dismissFirstRunWizard(page);
    await page.goto(`/?chatId=${encodeURIComponent(chat.id)}`);
    await expect(page).toHaveURL(
      (url) =>
        url.pathname.startsWith("/studio") &&
        url.searchParams.get("chatId") === chat.id,
    );
  });

  test("deleting a chat removes it from the list", async ({
    page,
    request,
  }) => {
    const title = `Delete me ${Date.now()}`;
    await createChat(request, { title });
    await gotoStudio(page);
    await ensureChatsPanelOpen(page);

    await expect(page.getByText(title).first()).toBeVisible();

    const row = page.getByRole("listitem").filter({ hasText: title });
    await row.hover();
    await row.getByRole("button", { name: `Delete ${title}` }).click();
    await page
      .getByRole("alertdialog", { name: "Delete chat?" })
      .getByRole("button", { name: "Delete", exact: true })
      .click();

    await expect(page.getByText(title)).toHaveCount(0, { timeout: 15_000 });
  });
});
