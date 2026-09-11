import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";

test("app shell renders and primary navigation works", async ({ page }, testInfo) => {
  const browserMessages: string[] = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      browserMessages.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => browserMessages.push(`pageerror: ${error.message}`));

  await page.goto("/");
  await expect(page).toHaveTitle(/Threads AI Editor/);
  await expect(page.getByRole("heading", { name: "Today's briefing" })).toBeVisible();
  await expect(page.locator("body")).not.toBeEmpty();
  await expect(page.locator("[data-nextjs-dialog-overlay]")).toHaveCount(0);
  await page.screenshot({
    path: path.join(os.tmpdir(), `threads-ai-editor-${testInfo.project.name}-today.png`),
    fullPage: true,
  });

  const navName = testInfo.project.name === "mobile" ? "Mobile primary" : "Primary";
  await page.getByRole("navigation", { name: navName }).getByRole("link", { name: "Discover" }).click();
  await expect(page).toHaveURL(/\/discover$/);
  await expect(page.getByRole("heading", { name: "Discover" })).toBeVisible();
  await expect(page.locator("[data-nextjs-dialog-overlay]")).toHaveCount(0);

  expect(browserMessages, browserMessages.join("\n")).toEqual([]);
});
