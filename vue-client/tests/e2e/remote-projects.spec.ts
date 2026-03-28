import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import net from "node:net";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

let serverProcess: ChildProcessWithoutNullStreams | null = null;
const testServerPort = 50062;
const adminUsername = "admin";
const adminPassword = "remote-admin-pass";

function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function checkPortOpen(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket
      .once("connect", () => {
        socket.destroy();
        resolve(true);
      })
      .once("error", () => {
        socket.destroy();
        resolve(false);
      })
      .connect(port, host);
  });
}

async function waitForPort(port: number, timeoutMs: number): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await checkPortOpen(port)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timeout waiting for port ${port}`);
}

async function loginRemote(page: Page): Promise<void> {
  await page.goto("/auth?next=/app/projects");
  await page.getByTestId("auth-endpoint-input").fill(`http://127.0.0.1:${testServerPort}`);
  await page.getByTestId("auth-username-input").fill(adminUsername);
  await page.getByTestId("auth-password-input").fill(adminPassword);
  await page.getByTestId("auth-btn-login").click();
  await expect(page.getByTestId("project-form")).toBeVisible();
}

test.describe("remote projects", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  test.beforeAll(async ({}, testInfo) => {
    testInfo.setTimeout(180_000);
    const repoRoot = path.resolve(process.cwd(), "..");
    serverProcess = spawn("cargo", ["run", "-p", "server"], {
      cwd: repoRoot,
      env: {
        ...process.env,
        GRPC_ADDR: `127.0.0.1:${testServerPort}`,
        GRPC_ADMIN_USERNAME: adminUsername,
        GRPC_ADMIN_PASSWORD: adminPassword,
      },
      stdio: "pipe",
    });

    await waitForPort(testServerPort, 150_000);
  });

  test.afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill("SIGTERM");
      serverProcess = null;
    }
  });

  test("remote project CRUD", async ({ page }) => {
    await loginRemote(page);

    const name = uniqueName("remote-project");
    const updatedName = `${name}-updated`;

    await page.getByTestId("project-name-input").fill(name);
    await page.getByTestId("project-description-input").fill("remote project e2e");
    await page.getByTestId("project-owner-input").fill(adminUsername);
    await page.getByTestId("project-members-input").fill("admin,bob");
    await page.getByTestId("project-submit-btn").click();

    await expect(page.getByText(`已创建项目：${name}`)).toBeVisible();
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
});
