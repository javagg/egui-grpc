<template>
  <section class="content-stack">
    <article class="panel hero-summary">
      <div>
        <p class="eyebrow">Platform Overview</p>
        <h3>面向电磁仿真团队的协作式工作台</h3>
        <p>
          当前版本先承接认证、测试与运行链路，后续会逐步迁移项目管理、任务编排、结果分析与权限分级页面。
        </p>
      </div>
      <div class="summary-pills">
        <span>建模</span>
        <span>求解</span>
        <span>对比</span>
        <span>协同</span>
      </div>
    </article>

    <div class="info-grid">
      <article class="panel metric-panel">
        <p>当前接入模式</p>
        <strong>{{ authSession.mode === "local" ? "Local First" : "Remote gRPC-Web" }}</strong>
        <span>可在测试页验证接口联通与交互行为</span>
      </article>
      <article class="panel metric-panel">
        <p>接入终端</p>
        <strong>{{ authSession.endpoint }}</strong>
        <span>作为当前会话的服务端访问地址</span>
      </article>
      <article class="panel metric-panel">
        <p>用户身份</p>
        <strong>{{ authSession.isSuperuser ? "Superuser" : "Standard" }}</strong>
        <span>当前登录账号：{{ authSession.currentUser }}</span>
      </article>
    </div>

    <div class="info-grid">
      <article class="panel metric-panel">
        <p>参与项目数</p>
        <strong data-testid="home-project-count">{{ currentUserProjectCount }}</strong>
        <span>按成员身份统计当前用户参与的项目</span>
      </article>

      <article class="panel recent-projects-panel">
        <h3>最近项目</h3>
        <p v-if="currentUserRecentProjects.length === 0" class="hint">当前用户还没有项目记录。</p>
        <ul v-else class="recent-projects" data-testid="home-recent-projects">
          <li v-for="project in currentUserRecentProjects" :key="project.id">
            <strong>{{ project.name }}</strong>
            <span>{{ project.description || "(无描述)" }}</span>
          </li>
        </ul>
      </article>
    </div>

    <div class="info-grid">
      <article class="panel">
        <h3>后续迁移方向</h3>
        <ul class="panel-list">
          <li>项目首页：项目列表、状态概览、最近结果</li>
          <li>仿真任务：参数集、队列进度、日志与失败重试</li>
          <li>结果中心：S 参数、近远场、几何版本对比</li>
        </ul>
      </article>
      <article class="panel">
        <h3>当前建议</h3>
        <ul class="panel-list">
          <li>先在测试页验证鉴权与 gRPC 链路稳定性</li>
          <li>再逐步拆分现有调试能力到独立业务页</li>
          <li>设置页用于沉淀会话配置与环境信息</li>
        </ul>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { authSession } from "../auth/session";
import { currentUserProjectCount, currentUserRecentProjects } from "../projects/projectStore";
</script>
