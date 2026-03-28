<template>
  <section class="content-stack">
    <article class="panel">
      <p class="eyebrow">Session Settings</p>
      <h3>当前会话设置</h3>
      <div class="settings-grid">
        <div>
          <span class="settings-label">登录用户</span>
          <strong>{{ authSession.currentUser }}</strong>
        </div>
        <div>
          <span class="settings-label">账号角色</span>
          <strong>{{ authSession.isSuperuser ? "超级用户" : "普通用户" }}</strong>
        </div>
        <div>
          <span class="settings-label">运行模式</span>
          <strong>{{ authSession.mode }}</strong>
        </div>
        <div>
          <span class="settings-label">服务端地址</span>
          <strong>{{ authSession.endpoint }}</strong>
        </div>
      </div>
    </article>

    <article class="panel">
      <h3>迁移说明</h3>
      <ul class="panel-list">
        <li>当前页面先承载会话信息与环境摘要</li>
        <li>后续可迁入用户资料、API 终端管理、主题设置、团队空间配置</li>
        <li>现有 gRPC 调试能力已迁移到侧边栏中的“测试页”</li>
      </ul>
    </article>
  </section>
</template>

<script setup lang="ts">
import { authSession } from "../auth/session";
</script>
