<template>
  <main class="page auth-page">
    <section class="card auth-card">
      <p class="eyebrow">Console Access</p>
      <h1>登录控制台</h1>
      <p class="hint">完成身份验证后进入电磁仿真 SaaS 主页面。</p>

      <div class="form-row">
        <label>Mode</label>
        <select v-model="mode" data-testid="auth-mode-select">
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
          data-testid="auth-endpoint-input"
        />
      </div>

      <div class="form-row">
        <label>Username</label>
        <input v-model="username" placeholder="admin" data-testid="auth-username-input" />
      </div>

      <div class="form-row">
        <label>Password</label>
        <input
          v-model="password"
          type="password"
          placeholder="admin123456"
          data-testid="auth-password-input"
        />
      </div>

      <div class="actions">
        <button :disabled="busy" @click="runRegister" data-testid="auth-btn-register">Register</button>
        <button :disabled="busy" @click="runLogin" data-testid="auth-btn-login">Login</button>
      </div>

      <div class="status" data-testid="auth-status">{{ statusText }}</div>
      <p v-if="mode === 'local'" class="hint">Local 模式下不支持动态注册，请使用配置好的管理员账号。</p>
      <RouterLink class="ghost-link" to="/">返回产品页</RouterLink>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { authSession, setAuthSession, updateAuthConfig, type AppMode } from "../auth/session";
import { login, register } from "../grpc/grpcWeb";

const router = useRouter();
const route = useRoute();

const mode = ref<AppMode>(authSession.mode);
const endpoint = ref(authSession.endpoint);
const username = ref("admin");
const password = ref("admin123456");
const busy = ref(false);
const statusText = ref("请输入账号密码后登录。");

const localExpectedToken = import.meta.env.VITE_LOCAL_AUTH_TOKEN ?? "dev-token";
const localAdminUsername = import.meta.env.VITE_LOCAL_ADMIN_USERNAME ?? "admin";
const localAdminPassword = import.meta.env.VITE_LOCAL_ADMIN_PASSWORD ?? "admin123456";

watch(mode, (value) => {
  updateAuthConfig({ mode: value });
});

watch(endpoint, (value) => {
  updateAuthConfig({ endpoint: value });
});

const nextPath = computed(() => {
  const raw = route.query.next;
  return typeof raw === "string" && raw.startsWith("/") ? raw : "/app/home";
});

async function runWithGuard(task: () => Promise<void>): Promise<void> {
  if (busy.value) {
    return;
  }

  busy.value = true;
  try {
    await task();
  } catch (error) {
    statusText.value = `Error: ${String(error)}`;
  } finally {
    busy.value = false;
  }
}

function ensureInputs(): void {
  if (username.value.trim().length === 0 || password.value.length === 0) {
    throw new Error("username/password must not be empty");
  }
}

async function runLogin(): Promise<void> {
  await runWithGuard(async () => {
    ensureInputs();

    if (mode.value === "local") {
      if (username.value !== localAdminUsername || password.value !== localAdminPassword) {
        throw new Error("invalid local admin credentials");
      }

      setAuthSession({
        token: localExpectedToken,
        currentUser: username.value,
        isSuperuser: true,
        mode: mode.value,
        endpoint: endpoint.value,
      });
      statusText.value = `Local login success: ${username.value}`;
      await router.replace(nextPath.value);
      return;
    }

    const reply = await login(endpoint.value, {
      username: username.value,
      password: password.value,
    });

    setAuthSession({
      token: reply.token,
      currentUser: reply.username,
      isSuperuser: reply.isSuperuser,
      mode: mode.value,
      endpoint: endpoint.value,
    });

    statusText.value = `Login success: ${reply.username}`;
    await router.replace(nextPath.value);
  });
}

async function runRegister(): Promise<void> {
  await runWithGuard(async () => {
    ensureInputs();

    if (mode.value === "local") {
      throw new Error("local-first mode does not support dynamic register");
    }

    const reply = await register(endpoint.value, {
      username: username.value,
      password: password.value,
    });

    if (!reply.ok) {
      throw new Error("register failed");
    }

    setAuthSession({
      token: reply.token,
      currentUser: reply.username,
      isSuperuser: reply.isSuperuser,
      mode: mode.value,
      endpoint: endpoint.value,
    });

    statusText.value = `Register success: ${reply.username}`;
    await router.replace(nextPath.value);
  });
}
</script>
