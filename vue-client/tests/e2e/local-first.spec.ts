import { expect, test } from "@playwright/test";

test("local-first unary runs without server", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("mode-select").selectOption("local");
  await page.getByTestId("name-input").fill("alice");
  await page.getByTestId("message-input").fill("from unary");

  await page.getByTestId("btn-unary").click();

  await expect(page.getByText("Unary response: Unary: hello alice, message=from unary")).toBeVisible();
  await expect(page.getByTestId("status-text")).toHaveText("Idle");
});

test("local-first server stream emits 5 chunks then completes", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("mode-select").selectOption("local");
  await page.getByTestId("name-input").fill("bob");
  await page.getByTestId("message-input").fill("streaming");

  await page.getByTestId("btn-server-stream").click();

  for (let i = 1; i <= 5; i += 1) {
    await expect(page.getByText(`ServerStream -> Server stream #${i} -> bob`)).toBeVisible();
  }
  await expect(page.getByText("ServerStream completed")).toBeVisible();
});

test("local-first bidi stream emits 3 messages then completes", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("mode-select").selectOption("local");
  await page.getByTestId("name-input").fill("charlie");
  await page.getByTestId("message-input").fill("ping");

  await page.getByTestId("btn-bidi-stream").click();

  await expect(page.getByText("BidiStream <- Bidi echo => charlie says ping A")).toBeVisible();
  await expect(page.getByText("BidiStream <- Bidi echo => charlie says ping B")).toBeVisible();
  await expect(page.getByText("BidiStream <- Bidi echo => charlie says ping C")).toBeVisible();
  await expect(page.getByText("BidiStream completed")).toBeVisible();
});
