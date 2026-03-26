<template>
  <main class="page">
    <section class="card">
      <h1>Vue3 + TypeScript gRPC-Web Demo</h1>
      <p class="hint">服务端请先启动在 http://127.0.0.1:50051</p>

      <div class="form-row">
        <label>Server endpoint</label>
        <input v-model="endpoint" placeholder="http://127.0.0.1:50051" />
      </div>

      <div class="form-row">
        <label>Name</label>
        <input v-model="name" />
      </div>

      <div class="form-row">
        <label>Message</label>
        <input v-model="message" />
      </div>

      <div class="actions">
        <button :disabled="busy" @click="runUnary">Unary</button>
        <button :disabled="busy" @click="runServerStream">Server Stream</button>
        <button :disabled="busy" @click="runClientStream">Client Stream</button>
        <button :disabled="busy" @click="runBidiStream">Bidirectional Stream</button>
      </div>

      <div class="status">{{ busy ? "Running..." : "Idle" }}</div>

      <h2>Logs</h2>
      <div class="logs">
        <div v-for="(line, idx) in logs" :key="idx" class="log-line">{{ line }}</div>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { bidiStream, clientStream, sayHello, serverStream } from "./grpc/grpcWeb";

const endpoint = ref("http://127.0.0.1:50051");
const name = ref("vue-user");
const message = ref("hello grpc from vue");
const logs = ref<string[]>(["Ready. Click any gRPC pattern button."]);
const busy = ref(false);

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
    pushLog("Calling Unary...");
    const reply = await sayHello(endpoint.value, {
      name: name.value,
      message: message.value,
    });
    pushLog(`Unary response: ${reply.message}`);
  });
}

async function runServerStream(): Promise<void> {
  await runWithGuard(async () => {
    pushLog("Calling ServerStream...");
    await serverStream(
      endpoint.value,
      {
        name: name.value,
        message: message.value,
      },
      (reply) => pushLog(`ServerStream -> ${reply.message}`),
    );
    pushLog("ServerStream completed");
  });
}

async function runClientStream(): Promise<void> {
  await runWithGuard(async () => {
    pushLog("Calling ClientStream...");
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
    pushLog("Calling BidiStream...");
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
