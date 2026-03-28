import { expect, test, type Page } from "@playwright/test";

function uniq(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

async function loginLocal(page: Page): Promise<void> {
  if (await page.getByTestId("project-form").count()) {
    return;
  }

  await page.goto("/auth?next=/app/projects");
  await page.getByTestId("auth-username-input").fill("admin");
  await page.getByTestId("auth-password-input").fill("admin123456");
  await page.getByTestId("auth-btn-login").click();
  await expect(page.getByTestId("project-form")).toBeVisible();
}

test("local studio opens from project card and requires confirmation on back", async ({ page }) => {
  await page.goto("/app/projects");
  await loginLocal(page);

  const name = uniq("studio-project");
  const description = "studio e2e context";

  await page.getByTestId("project-name-input").fill(name);
  await page.getByTestId("project-description-input").fill(description);
  await page.getByTestId("project-owner-input").fill("admin");
  await page.getByTestId("project-members-input").fill("admin,alice,bob");
  await page.getByTestId("project-submit-btn").click();

  await expect(page.getByText(`已创建项目：${name}`)).toBeVisible();

  const projectCard = page.locator("article").filter({ has: page.getByRole("heading", { name }) }).first();
  await projectCard.getByTestId("project-open-btn").click();

  await expect(page).toHaveURL(/\/studio\//);
  await expect(page.getByTestId("studio-project-title")).toHaveText(name);
  await expect(page.getByTestId("studio-project-chip")).not.toBeEmpty();
  await expect(page.getByTestId("studio-loading")).toHaveCount(0);

  const dismissDialog = page.waitForEvent("dialog");
  await page.goBack();
  const firstDialog = await dismissDialog;
  expect(firstDialog.message()).toContain("确认离开当前工作台");
  await firstDialog.dismiss();

  await expect(page).toHaveURL(/\/studio\//);
  await expect(page.getByTestId("studio-project-title")).toHaveText(name);

  const acceptDialog = page.waitForEvent("dialog");
  await page.goBack();
  const secondDialog = await acceptDialog;
  expect(secondDialog.message()).toContain("确认离开当前工作台");
  await secondDialog.accept();

  await expect(page).toHaveURL(/\/app\/projects/);
  await expect(page.getByRole("heading", { name })).toBeVisible();
});

test("local studio exit button requires confirmation before leaving", async ({ page }) => {
  await page.goto("/app/projects");
  await loginLocal(page);

  const name = uniq("studio-exit");

  await page.getByTestId("project-name-input").fill(name);
  await page.getByTestId("project-description-input").fill("studio exit confirm");
  await page.getByTestId("project-owner-input").fill("admin");
  await page.getByTestId("project-members-input").fill("admin,alice");
  await page.getByTestId("project-submit-btn").click();
  await expect(page.getByText(`已创建项目：${name}`)).toBeVisible();

  const projectCard = page.locator("article").filter({ has: page.getByRole("heading", { name }) }).first();
  await projectCard.getByTestId("project-open-btn").click();

  await expect(page).toHaveURL(/\/studio\//);
  await expect(page.getByTestId("studio-project-title")).toHaveText(name);

  let firstDialogMessage = "";
  page.once("dialog", async (dialog) => {
    firstDialogMessage = dialog.message();
    await dialog.dismiss();
  });
  await page.evaluate(() => {
    const button = document.querySelector('[data-testid="studio-exit-btn"]') as HTMLButtonElement | null;
    button?.click();
  });
  await expect.poll(() => firstDialogMessage).toContain("确认离开当前工作台");

  await expect(page).toHaveURL(/\/studio\//);
  await expect(page.getByTestId("studio-project-title")).toHaveText(name);

  let secondDialogMessage = "";
  page.once("dialog", async (dialog) => {
    secondDialogMessage = dialog.message();
    await dialog.accept();
  });
  await page.evaluate(() => {
    const button = document.querySelector('[data-testid="studio-exit-btn"]') as HTMLButtonElement | null;
    button?.click();
  });
  await expect.poll(() => secondDialogMessage).toContain("确认离开当前工作台");

  await expect(page).toHaveURL(/\/app\/projects/);
  await expect(page.getByRole("heading", { name })).toBeVisible();
});