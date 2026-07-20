import { expect, test } from "@playwright/test";

test("loads the app", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Canvas 制作工具" })).toBeVisible();
  await expect(page.getByText("画布区域")).toBeVisible();
});
