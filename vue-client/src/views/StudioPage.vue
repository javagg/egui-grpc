<template>
  <section class="studio-page">
    <canvas :id="canvasId" class="studio-canvas"></canvas>

    <div class="studio-overlay studio-hud">
      <div>
        <p class="eyebrow">Simulation Studio</p>
        <h2 data-testid="studio-project-title">{{ projectTitle }}</h2>
        <p class="hint">全屏建模与分析工作台已载入到当前项目上下文。</p>
      </div>

      <div class="studio-hud-actions">
        <span class="studio-project-chip" data-testid="studio-project-chip">{{ projectId }}</span>
        <button type="button" class="ghost-link studio-exit-button" data-testid="studio-exit-btn" @click="goBackToProjects">返回项目页</button>
      </div>
    </div>

    <div v-if="initializing" class="studio-overlay studio-loading" data-testid="studio-loading">
      <div class="studio-spinner" aria-hidden="true"></div>
      <p>Studio 组件较大，正在加载 wasm 工作台...</p>
    </div>

    <div v-if="errorMessage" class="studio-overlay studio-error-panel" data-testid="studio-error-panel">
      <h3>Studio 启动失败</h3>
      <p>{{ errorMessage }}</p>
      <div class="actions">
        <button type="button" @click="retryMount">重试</button>
        <button type="button" class="ghost-link studio-exit-button" @click="goBackToProjects">返回项目页</button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";
import { getProjectById, refreshProjects, type Project } from "../projects/projectStore";

interface StudioWasmModule {
  default: (input?: string | URL | Request | Response | BufferSource | WebAssembly.Module) => Promise<unknown>;
  start_with_canvas_id: (canvasId: string) => Promise<void>;
  start_with_canvas_and_project: (
    canvasId: string,
    projectId: string,
    projectName: string,
    projectDescription: string,
    ownerUserId: string,
    memberCount: number,
  ) => Promise<void>;
}

const route = useRoute();
const router = useRouter();
const studioModuleUrl = "/wasm/studio/studio.js";
const studioWasmUrl = "/wasm/studio/studio_bg.wasm";
const projectId = computed(() => String(route.params.projectId ?? ""));
const project = ref<Project | undefined>(getProjectById(projectId.value));
const initializing = ref(true);
const errorMessage = ref("");
const allowLeave = ref(false);
const canvasId = `studio-canvas-${projectId.value || "default"}`;

const projectTitle = computed(() => project.value?.name ?? "仿真工作台");

async function loadStudioModule(): Promise<StudioWasmModule> {
  const response = await fetch(studioModuleUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`failed to load studio module: ${response.status}`);
  }

  const source = await response.text();
  const blob = new Blob([source], { type: "text/javascript" });
  const moduleUrl = URL.createObjectURL(blob);

  try {
    return (await import(/* @vite-ignore */ moduleUrl)) as StudioWasmModule;
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
}

function handleBeforeUnload(event: BeforeUnloadEvent): void {
  event.preventDefault();
  event.returnValue = "";
}

async function ensureProjectLoaded(): Promise<void> {
  if (project.value) {
    return;
  }

  try {
    await refreshProjects();
    project.value = getProjectById(projectId.value);
  } catch {
    project.value = undefined;
  }
}

async function mountStudio(): Promise<void> {
  initializing.value = true;
  errorMessage.value = "";

  try {
    await ensureProjectLoaded();
    const studioModule = await loadStudioModule();
    await studioModule.default(studioWasmUrl);
    await studioModule.start_with_canvas_and_project(
      canvasId,
      projectId.value,
      project.value?.name ?? "仿真工作台",
      project.value?.description ?? "当前项目暂无描述。",
      project.value?.ownerUserId ?? "unknown",
      project.value?.memberUserIds.length ?? 0,
    );
  } catch (error) {
    errorMessage.value = String(error);
  } finally {
    initializing.value = false;
  }
}

function confirmLeave(): boolean {
  if (allowLeave.value) {
    return true;
  }

  const confirmed = window.confirm("Studio 正在运行，确认离开当前工作台吗？");
  if (confirmed) {
    allowLeave.value = true;
  }
  return confirmed;
}

async function goBackToProjects(): Promise<void> {
  if (!confirmLeave()) {
    return;
  }

  await router.push({ name: "project" });
}

async function retryMount(): Promise<void> {
  await mountStudio();
}

onBeforeRouteLeave(() => confirmLeave());

onMounted(() => {
  window.addEventListener("beforeunload", handleBeforeUnload);
  document.body.classList.add("studio-route-active");
  void mountStudio();
});

onBeforeUnmount(() => {
  document.body.classList.remove("studio-route-active");
  window.removeEventListener("beforeunload", handleBeforeUnload);
});
</script>