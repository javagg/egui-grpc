<template>
  <main class="page">
    <section class="card">
      <h1>Vue3 + TypeScript gRPC-Web Demo</h1>
      <p class="hint">
        当前用户：{{ authSession.currentUser }}{{ authSession.isSuperuser ? " (superuser)" : "" }}
      </p>

      <div class="form-row">
        <label>Mode</label>
        <select v-model="mode" data-testid="mode-select">
          <option value="remote">Remote gRPC-Web</option>
          <option value="local">Local First (Worker + WASM)</option>
        </select>
      </div>

      <div class="form-row">
        <label>Server endpoint</label>
        <input
          v-model="endpoint"
          placeholder="http://127.0.0.1:50051"
          :disabled="mode === 'local'"
          data-testid="endpoint-input"
        />
      </div>

      <div class="actions">
        <button :disabled="busy" @click="runLogout" data-testid="btn-logout">Logout</button>
      </div>

      <div class="form-row">
        <label>Name</label>
        <input v-model="name" data-testid="name-input" />
      </div>

      <div class="form-row">
        <label>Message</label>
        <input v-model="message" data-testid="message-input" />
      </div>

      <div class="actions">
        <button :disabled="busy" @click="runUnary" data-testid="btn-unary">Unary</button>
        <button :disabled="busy" @click="runServerStream" data-testid="btn-server-stream">Server Stream</button>
        <button :disabled="busy" @click="runClientStream" data-testid="btn-client-stream">Client Stream</button>
        <button :disabled="busy" @click="runBidiStream" data-testid="btn-bidi-stream">Bidirectional Stream</button>
      </div>

      <div class="status" data-testid="status-text">{{ busy ? "Running..." : "Idle" }}</div>

      <h2>Logs</h2>
      <div class="logs" data-testid="logs-panel">
        <div v-for="(line, idx) in logs" :key="idx" class="log-line">{{ line }}</div>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useRouter } from "vue-router";
import { authSession, clearAuthSession, updateAuthConfig, type AppMode } from "../auth/session";
import { bidiStream, clientStream, logout, sayHello, serverStream } from "../grpc/grpcWeb";
import { callLocalBackendStream } from "../local/workerClient";

const router = useRouter();

const mode = ref<AppMode>(authSession.mode);
const endpoint = ref(authSession.endpoint);
const name = ref("vue-user");
const message = ref("hello grpc from vue");
const logs = ref<string[]>(["Ready. Choose a gRPC pattern and run."]);
const busy = ref(false);

watch(mode, (next, prev) => {
  updateAuthConfig({ mode: next });
  if (next !== prev) {
    clearAuthSession({ preserveConfig: true });
    pushLog("Mode changed. Please login again.");
    void router.replace("/auth");
  }
});

watch(endpoint, (value) => {
  updateAuthConfig({ endpoint: value });
});

function pushLog(line: string): void {
  logs.value.push(line);
}

async function runWithGuard(task: () => Promise<void>): Promise<void> {
  if (busy.value) {
    pushLog("A request is already running");
    return;
  }
  busy.value = true;
  try {
    await task();
  } catch (err) {
    pushLog(`Error: ${String(err)}`);
  } finally {
    busy.value = false;
  }
}

function tokenOrThrow(): string {
  if (authSession.token.length > 0) {
    return authSession.token;
  }
  throw new Error("not logged in");
}

async function runLogout(): Promise<void> {
  await runWithGuard(async () => {
    const token = tokenOrThrow();

    if (mode.value === "remote") {
      await logout(endpoint.value, token);
    }

    const user = authSession.currentUser;
    clearAuthSession({ preserveConfig: true });
    pushLog(`Logged out ${user}`);
    await router.replace("/auth");
  });
}

async function runUnary(): Promise<void> {
  await runWithGuard(async () => {
    const token = tokenOrThrow();

    if (mode.value === "local") {
      pushLog("Calling Unary in local-first mode...");
      await callLocalBackendStream("Unary", token, name.value, message.value, (line) => {
        pushLog(`Unary response: ${line}`);
      });
      return;
    }

    pushLog("Calling Unary in remote gRPC-web mode...");
    const reply = await sayHello(endpoint.value, { name: name.value, message: message.value }, token);
    pushLog(`Unary response: ${reply.message}`);
  });
}

async function runServerStream(): Promise<void> {
  await runWithGuard(async () => {
    const token = tokenOrThrow();

    if (mode.value === "local") {
      pushLog("Calling ServerStream in local-first mode...");
      await callLocalBackendStream("ServerStream", token, name.value, message.value, (line) => {
        pushLog(`ServerStream -> ${line}`);
      });
      pushLog("ServerStream completed");
      return;
    }

    pushLog("Calling ServerStream in remote gRPC-web mode...");
    await serverStream(endpoint.value, { name: name.value, message: message.value }, token, (reply) =>
      pushLog(`ServerStream -> ${reply.message}`),
    );
    pushLog("ServerStream completed");
  });
}

async function runClientStream(): Promise<void> {
  await runWithGuard(async () => {
    const token = tokenOrThrow();

    if (mode.value === "local") {
      pushLog("Calling ClientStream in local-first mode...");
      await callLocalBackendStream("ClientStream", token, name.value, message.value, (line) => {
        pushLog(`ClientStream response: ${line}`);
      });
      return;
    }

    pushLog("Calling ClientStream in remote gRPC-web mode...");
    const reply = await clientStream(
      endpoint.value,
      [
        { name: name.value, message: `${message.value} #1` },
        { name: name.value, message: `${message.value} #2` },
        { name: name.value, message: `${message.value} #3` },
      ],
      token,
    );
    pushLog(`ClientStream response: ${reply.message}`);
  });
}

async function runBidiStream(): Promise<void> {
  await runWithGuard(async () => {
    const token = tokenOrThrow();

    if (mode.value === "local") {
      pushLog("Calling BidiStream in local-first mode...");
      await callLocalBackendStream("BidiStream", token, name.value, message.value, (line) => {
        pushLog(`BidiStream <- ${line}`);
      });
      pushLog("BidiStream completed");
      return;
    }

    pushLog("Calling BidiStream in remote gRPC-web mode...");
    await bidiStream(
      endpoint.value,
      [
        { name: name.value, message: `${message.value} A` },
        { name: name.value, message: `${message.value} B` },
        { name: name.value, message: `${message.value} C` },
      ],
      token,
      (reply) => pushLog(`BidiStream <- ${reply.message}`),
    );
    pushLog("BidiStream completed");
  });
}
</script>
