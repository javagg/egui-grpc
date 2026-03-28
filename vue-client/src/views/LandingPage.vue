<template>
  <main class="landing-page">
    <section class="hero-panel">
      <div class="hero-copy">
        <p class="eyebrow">Electromagnetic Simulation SaaS</p>
        <h1>把电磁仿真从本地工作站，迁移到可协作的云端工程平台。</h1>
        <p class="hero-text">
          面向天线、射频链路、封装互连与高速结构设计团队，提供统一建模、批量求解、版本留痕与结果协同。
          研发团队先看到方案空间，再决定算力投入。
        </p>
        <div class="hero-actions">
          <button class="hero-button" data-testid="landing-enter" @click="enterProduct">进入控制台</button>
          <RouterLink class="ghost-link" to="/auth">已有账号，直接登录</RouterLink>
        </div>
        <div class="hero-metrics">
          <article>
            <strong>10x</strong>
            <span>参数扫描效率提升</span>
          </article>
          <article>
            <strong>3 min</strong>
            <span>创建首个仿真项目</span>
          </article>
          <article>
            <strong>24/7</strong>
            <span>远程任务监控与结果回溯</span>
          </article>
        </div>
      </div>

      <aside class="hero-showcase">
        <div class="showcase-card accent-card">
          <p>场景能力</p>
          <h2>统一覆盖建模、求解、对比与交付</h2>
          <ul>
            <li>参数化几何与材料模板</li>
            <li>云端队列调度与多工况批运行</li>
            <li>结果快照、评论与版本对齐</li>
          </ul>
        </div>
        <div class="showcase-grid">
          <article class="showcase-card">
            <p>典型对象</p>
            <h3>天线 / 波导 / 连接器 / PCB 结构</h3>
          </article>
          <article class="showcase-card">
            <p>团队方式</p>
            <h3>建模工程师、算法工程师、验证工程师共用一套数据面板</h3>
          </article>
        </div>
      </aside>
    </section>

    <section class="landing-strip">
      <article>
        <h2>从单机仿真转向产品化工程系统</h2>
        <p>不只做求解器调用，更管理项目上下文、仿真策略和结果流转。</p>
      </article>
      <article>
        <h2>从脚本驱动转向业务可视化</h2>
        <p>把参数、日志和结果放在统一界面，让非算法角色也能参与协同。</p>
      </article>
      <article>
        <h2>从一次性分析转向持续优化</h2>
        <p>保留实验路径与对比证据，支撑产品迭代和工程审查。</p>
      </article>
    </section>
  </main>
</template>

<script setup lang="ts">
import { RouterLink, useRouter } from "vue-router";
import { isAuthenticated } from "../auth/session";

const router = useRouter();

function enterProduct(): void {
  if (isAuthenticated.value) {
    void router.push("/app/home");
    return;
  }

  void router.push("/auth?next=/app/home");
}
</script>
