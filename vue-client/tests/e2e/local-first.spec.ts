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

test("local-first unary is rejected when bearer token is invalid", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("mode-select").selectOption("local");
  await page.getByTestId("token-input").fill("wrong-token");
  await page.getByTestId("name-input").fill("alice");
  await page.getByTestId("message-input").fill("from unary");

  await page.getByTestId("btn-unary").click();

  await expect(page.getByText(/Error: Error: unauthorized local-first token/i)).toBeVisible();
});

test("local-first unary can trigger surrealdb indexeddb roundtrip", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("mode-select").selectOption("local");
  await page.getByTestId("name-input").fill("local-db-user");
  await page.getByTestId("message-input").fill("db-test:hello-indexeddb");

  await page.getByTestId("btn-unary").click();

  await expect(page.getByText(/Unary response: DB_TEST_OK/)).toBeVisible();
  await expect(page.getByText(/value=local-db-user::hello-indexeddb/)).toBeVisible();
});

test("local-first surrealdb data survives page reload via indexeddb", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("mode-select").selectOption("local");
  await page.getByTestId("name-input").fill("persist-user");
  await page.getByTestId("message-input").fill("db-test:persist-value");

  await page.getByTestId("btn-unary").click();
  await expect(page.getByText(/Unary response: DB_TEST_OK/)).toBeVisible();

  await page.reload();
  await page.getByTestId("mode-select").selectOption("local");
  await page.getByTestId("name-input").fill("persist-user");
  await page.getByTestId("message-input").fill("db-read:persist-value");

  await page.getByTestId("btn-unary").click();
  await expect(page.getByText(/Unary response: DB_READ_OK/)).toBeVisible();
  await expect(page.getByText(/value=persist-user::persist-value/)).toBeVisible();
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
