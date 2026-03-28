import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import net from "node:net";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

let serverProcess: ChildProcessWithoutNullStreams | null = null;
const testServerPort = 50061;
const adminUsername = "admin";
const adminPassword = "remote-admin-pass";
function uniqueUsername(prefix: string): string {
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
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await checkPortOpen(port)) {
      return;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Timeout waiting for ${port}`);
}

test.describe("remote surrealdb", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  async function loginRemote(page: Page): Promise<void> {
    await page.getByTestId("auth-endpoint-input").fill(`http://127.0.0.1:${testServerPort}`);
    await page.getByTestId("auth-username-input").fill(adminUsername);
    await page.getByTestId("auth-password-input").fill(adminPassword);
    await page.getByTestId("auth-btn-login").click();
    await expect(page.getByTestId("btn-unary")).toBeVisible();
  }

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

  test("remote unary can trigger surrealdb write/read roundtrip", async ({ page }) => {
    await page.goto("/app/test");
    await loginRemote(page);
    await page.getByTestId("name-input").fill("db-user");
    await page.getByTestId("message-input").fill("db-test:hello-surreal");

    await page.getByTestId("btn-unary").click();

    await expect(page.getByText(/Unary response: DB_TEST_OK/)).toBeVisible();
    await expect(page.getByText(/value=db-user::hello-surreal/)).toBeVisible();
  });

  test("remote user can register then login and call unary", async ({ page }) => {
    const username = uniqueUsername("user");
    const password = "user-pass-123";

    await page.goto("/auth?next=/app/test");
    await page.getByTestId("auth-endpoint-input").fill(`http://127.0.0.1:${testServerPort}`);
    await page.getByTestId("auth-username-input").fill(username);
    await page.getByTestId("auth-password-input").fill(password);

    await page.getByTestId("auth-btn-register").click();
    await expect(page.getByTestId("btn-unary")).toBeVisible();

    await page.getByTestId("name-input").fill("new-user");
    await page.getByTestId("message-input").fill("hello-after-register");
    await page.getByTestId("btn-unary").click();

    await expect(page.getByText("Unary response: Unary: hello new-user, message=hello-after-register")).toBeVisible();
  });

  test("remote unary requires login first", async ({ page }) => {
    await page.goto("/app/test");
    await expect(page.getByTestId("auth-btn-login")).toBeVisible();
    await expect(page.getByTestId("btn-unary")).toHaveCount(0);
  });
});
