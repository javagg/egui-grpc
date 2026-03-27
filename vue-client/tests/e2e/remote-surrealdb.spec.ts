import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import net from "node:net";
import path from "node:path";

import { expect, test } from "@playwright/test";

let serverProcess: ChildProcessWithoutNullStreams | null = null;
const testServerPort = 50061;
const testToken = "remote-e2e-token";

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
  test.setTimeout(180_000);

  test.beforeAll(async ({}, testInfo) => {
    testInfo.setTimeout(180_000);
    const repoRoot = path.resolve(process.cwd(), "..");
    serverProcess = spawn("cargo", ["run", "-p", "server"], {
      cwd: repoRoot,
      env: {
        ...process.env,
        GRPC_ADDR: `127.0.0.1:${testServerPort}`,
        GRPC_AUTH_TOKEN: testToken,
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
    await page.goto("/");
    await page.getByTestId("mode-select").selectOption("remote");
    await page.getByTestId("endpoint-input").fill(`http://127.0.0.1:${testServerPort}`);
    await page.getByTestId("token-input").fill(testToken);
    await page.getByTestId("name-input").fill("db-user");
    await page.getByTestId("message-input").fill("db-test:hello-surreal");

    await page.getByTestId("btn-unary").click();

    await expect(page.getByText(/Unary response: DB_TEST_OK/)).toBeVisible();
    await expect(page.getByText(/value=db-user::hello-surreal/)).toBeVisible();
  });

  test("remote unary is rejected when bearer token is missing", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("mode-select").selectOption("remote");
    await page.getByTestId("endpoint-input").fill(`http://127.0.0.1:${testServerPort}`);
    await page.getByTestId("token-input").fill("");
    await page.getByTestId("name-input").fill("db-user");
    await page.getByTestId("message-input").fill("hello-auth");

    await page.getByTestId("btn-unary").click();

    await expect(page.getByText(/Error: Error: (gRPC status 16|No reply from server)/i)).toBeVisible();
  });
});
