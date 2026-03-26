<template>
  <main class="page">
    <section class="card">
      <h1>Vue3 + TypeScript gRPC-Web Demo</h1>
      <p class="hint">支持两种模式：Remote(gRPC-Web) / Local First(Web Worker + Rust WASM)</p>

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
import { ref } from "vue";
import { bidiStream, clientStream, sayHello, serverStream } from "./grpc/grpcWeb";
import { callLocalBackendStream } from "./local/workerClient";

const endpoint = ref("http://127.0.0.1:50051");
const name = ref("vue-user");
const message = ref("hello grpc from vue");
const logs = ref<string[]>(["Ready. Click any gRPC pattern button."]);
const busy = ref(false);
const mode = ref<"remote" | "local">("remote");

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

async function runUnary(): Promise<void> {
  await runWithGuard(async () => {
    if (mode.value === "local") {
      pushLog("Calling Unary in local-first mode...");
      await callLocalBackendStream("Unary", name.value, message.value, (line) => {
        pushLog(`Unary response: ${line}`);
      });
      return;
    }

    pushLog("Calling Unary in remote gRPC-web mode...");
    const reply = await sayHello(endpoint.value, { name: name.value, message: message.value });
    pushLog(`Unary response: ${reply.message}`);
  });
}

async function runServerStream(): Promise<void> {
  await runWithGuard(async () => {
    if (mode.value === "local") {
      pushLog("Calling ServerStream in local-first mode...");
      await callLocalBackendStream("ServerStream", name.value, message.value, (line) => {
        pushLog(`ServerStream -> ${line}`);
      });
      pushLog("ServerStream completed");
      return;
    }

    pushLog("Calling ServerStream in remote gRPC-web mode...");
    await serverStream(endpoint.value, { name: name.value, message: message.value }, (reply) =>
      pushLog(`ServerStream -> ${reply.message}`),
    );
    pushLog("ServerStream completed");
  });
}

async function runClientStream(): Promise<void> {
  await runWithGuard(async () => {
    if (mode.value === "local") {
      pushLog("Calling ClientStream in local-first mode...");
      await callLocalBackendStream("ClientStream", name.value, message.value, (line) => {
        pushLog(`ClientStream response: ${line}`);
      });
      return;
    }

    pushLog("Calling ClientStream in remote gRPC-web mode...");
    const reply = await clientStream(endpoint.value, [
      { name: name.value, message: `${message.value} #1` },
      { name: name.value, message: `${message.value} #2` },
      { name: name.value, message: `${message.value} #3` },
    ]);
    pushLog(`ClientStream response: ${reply.message}`);
  });
}

async function runBidiStream(): Promise<void> {
  await runWithGuard(async () => {
    if (mode.value === "local") {
      pushLog("Calling BidiStream in local-first mode...");
      await callLocalBackendStream("BidiStream", name.value, message.value, (line) => {
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
      (reply) => pushLog(`BidiStream <- ${reply.message}`),
    );
    pushLog("BidiStream completed");
  });
}
</script>
