<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="sidebar-brand">
        <p class="eyebrow">EM Solver Cloud</p>
        <h1>控制台</h1>
        <span>产品、算例与协作统一入口</span>
      </div>

      <nav class="sidebar-nav">
        <RouterLink class="nav-link" to="/app/home">首页</RouterLink>
        <RouterLink class="nav-link" to="/app/test">测试页</RouterLink>
        <RouterLink class="nav-link" to="/app/settings">设置</RouterLink>
      </nav>

      <div class="sidebar-user">
        <p>当前用户</p>
        <strong>{{ authSession.currentUser }}</strong>
        <span>{{ authSession.isSuperuser ? "超级用户" : "标准用户" }}</span>
      </div>

      <button class="sidebar-logout" :disabled="busy" data-testid="btn-logout" @click="runLogout">
        {{ busy ? "处理中..." : "退出登录" }}
      </button>
      <p v-if="statusText" class="sidebar-status">{{ statusText }}</p>
    </aside>

    <div class="app-main">
      <header class="app-topbar">
        <div>
          <p class="eyebrow">Workspace</p>
          <h2>{{ pageTitle }}</h2>
        </div>
        <RouterLink class="topbar-link" to="/">返回产品页</RouterLink>
      </header>

      <section class="app-content">
        <RouterView />
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";
import { authSession, clearAuthSession } from "../auth/session";
import { logout } from "../grpc/grpcWeb";

const route = useRoute();
const router = useRouter();
const busy = ref(false);
const statusText = ref("");

const pageTitle = computed(() => {
  const title = route.meta.title;
  return typeof title === "string" ? title : "控制台";
});

async function runLogout(): Promise<void> {
  if (busy.value) {
    return;
  }

  busy.value = true;
  statusText.value = "";

  try {
    if (authSession.mode === "remote" && authSession.token) {
      await logout(authSession.endpoint, authSession.token);
    }
  } catch (error) {
    statusText.value = `远端会话注销失败，已清理本地登录态：${String(error)}`;
  } finally {
    clearAuthSession({ preserveConfig: true });
    busy.value = false;
    await router.replace("/auth?next=/app/home");
  }
}
</script>
