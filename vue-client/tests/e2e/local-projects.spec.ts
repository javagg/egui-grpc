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

test("local-first project CRUD and home summary", async ({ page }) => {
  await page.goto("/app/projects");
  await loginLocal(page);

  const name = uniq("local-project");
  const updatedName = `${name}-updated`;

  await page.getByTestId("project-name-input").fill(name);
  await page.getByTestId("project-description-input").fill("local e2e project");
  await page.getByTestId("project-owner-input").fill("admin");
  await page.getByTestId("project-members-input").fill("admin,alice");
  await page.getByTestId("project-submit-btn").click();

  await expect(page.getByText(`已创建项目：${name}`)).toBeVisible();
  await expect(page.getByText(updatedName)).toHaveCount(0);
  await expect(page.getByRole("heading", { name })).toBeVisible();

  await page.getByRole("button", { name: "编辑" }).first().click();
  await page.getByTestId("project-name-input").fill(updatedName);
  await page.getByTestId("project-submit-btn").click();

  await expect(page.getByText(`已更新项目：${updatedName}`)).toBeVisible();
  await expect(page.getByRole("heading", { name: updatedName })).toBeVisible();

  await page.getByRole("button", { name: "删除" }).first().click();
  await expect(page.getByText("已删除项目。")).toBeVisible();

  await page.goto("/app/home");
  await expect(page.getByTestId("home-project-count")).toContainText(/[0-9]+/);
});
