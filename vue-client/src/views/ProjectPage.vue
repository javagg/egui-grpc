<template>
  <section class="content-stack">
    <article class="panel panel-spacious">
      <div class="projects-header">
        <div>
          <p class="eyebrow">Project Workspace</p>
          <h3>仿真项目</h3>
          <p class="hint">先完成前端 Project CRUD 框架，后续再对接服务端接口。</p>
        </div>

        <div class="projects-toolbar">
          <span class="project-count">总计 {{ allProjects.length }} 项</span>
          <div class="view-switch" role="group" aria-label="project-view-mode">
            <button
              :class="['view-button', viewMode === 'card' ? 'active' : '']"
              data-testid="project-view-card"
              @click="viewMode = 'card'"
            >
              卡片
            </button>
            <button
              :class="['view-button', viewMode === 'list' ? 'active' : '']"
              data-testid="project-view-list"
              @click="viewMode = 'list'"
            >
              列表
            </button>
          </div>
        </div>
      </div>

      <form class="project-form" data-testid="project-form" @submit.prevent="submitForm">
        <div class="form-row">
          <label>项目名称</label>
          <input v-model="form.name" placeholder="例如：Ku 波段天线优化" data-testid="project-name-input" />
        </div>

        <div class="form-row">
          <label>项目描述</label>
          <input v-model="form.description" placeholder="说明项目目标、边界条件与输出要求" data-testid="project-description-input" />
        </div>

        <div class="form-row">
          <label>拥有者 User ID</label>
          <input v-model="form.ownerUserId" placeholder="默认当前登录用户" data-testid="project-owner-input" />
        </div>

        <div class="form-row">
          <label>成员 User IDs（逗号分隔）</label>
          <input v-model="form.membersRaw" placeholder="alice,bob,charlie" data-testid="project-members-input" />
        </div>

        <div class="actions">
          <button type="submit" data-testid="project-submit-btn">{{ editingId ? "更新项目" : "创建项目" }}</button>
          <button v-if="editingId" type="button" @click="resetForm">取消编辑</button>
        </div>

        <p class="status" data-testid="project-status">{{ statusText }}</p>
      </form>

      <div v-if="allProjects.length === 0" class="empty-state" data-testid="project-empty">
        还没有项目。先创建一个仿真项目开始。
      </div>

      <div v-else :class="viewMode === 'card' ? 'project-card-grid' : 'project-list-table'" data-testid="project-list">
        <article v-for="project in allProjects" :key="project.id" :class="viewMode === 'card' ? 'project-card' : 'project-row'">
          <div class="project-main">
            <div>
              <h4>{{ project.name }}</h4>
              <p class="project-description">{{ project.description || "(无描述)" }}</p>
            </div>
            <span class="project-badge">{{ project.memberUserIds.length }} 人参与</span>
          </div>

          <div class="project-meta">
            <span><strong>ID:</strong> {{ project.id }}</span>
            <span><strong>Owner:</strong> {{ project.ownerUserId }}</span>
            <span><strong>更新:</strong> {{ formatDate(project.updatedAt) }}</span>
          </div>

          <div class="project-actions">
            <button type="button" @click="startEdit(project)">编辑</button>
            <button type="button" @click="removeProject(project.id)">删除</button>
          </div>
        </article>
      </div>
    </article>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { authSession } from "../auth/session";
import {
  allProjects,
  createProject,
  deleteProject,
  type Project,
  updateProject,
} from "../projects/projectStore";

type ViewMode = "card" | "list";

interface ProjectForm {
  name: string;
  description: string;
  ownerUserId: string;
  membersRaw: string;
}

const viewMode = ref<ViewMode>("card");
const editingId = ref<string>("");
const statusText = ref("填写项目信息后点击创建。");
const form = ref<ProjectForm>({
  name: "",
  description: "",
  ownerUserId: authSession.currentUser,
  membersRaw: "",
});

function normalizeMemberIds(raw: string): string[] {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function resetForm(): void {
  editingId.value = "";
  form.value = {
    name: "",
    description: "",
    ownerUserId: authSession.currentUser,
    membersRaw: "",
  };
  statusText.value = "填写项目信息后点击创建。";
}

function submitForm(): void {
  try {
    const ownerUserId = form.value.ownerUserId.trim().length > 0
      ? form.value.ownerUserId.trim()
      : authSession.currentUser;

    const payload = {
      name: form.value.name,
      description: form.value.description,
      ownerUserId,
      memberUserIds: normalizeMemberIds(form.value.membersRaw),
    };

    if (editingId.value) {
      const updated = updateProject(editingId.value, payload);
      statusText.value = `已更新项目：${updated.name}`;
      resetForm();
      return;
    }

    const created = createProject(payload);
    statusText.value = `已创建项目：${created.name}`;
    resetForm();
  } catch (error) {
    statusText.value = `Error: ${String(error)}`;
  }
}

function startEdit(project: Project): void {
  editingId.value = project.id;
  form.value = {
    name: project.name,
    description: project.description,
    ownerUserId: project.ownerUserId,
    membersRaw: project.memberUserIds.join(","),
  };
  statusText.value = `正在编辑：${project.name}`;
}

function removeProject(projectId: string): void {
  if (editingId.value === projectId) {
    resetForm();
  }

  deleteProject(projectId);
  statusText.value = "已删除项目。";
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}
</script>
