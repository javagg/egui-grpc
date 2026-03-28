import { createRouter, createWebHistory } from "vue-router";
import { isAuthenticated } from "../auth/session";
import AppShell from "../views/AppShell.vue";
import AuthPage from "../views/AuthPage.vue";
import HomePage from "../views/HomePage.vue";
import LandingPage from "../views/LandingPage.vue";
import MainPage from "../views/MainPage.vue";
import SettingsPage from "../views/SettingsPage.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "landing",
      component: LandingPage,
    },
    {
      path: "/auth",
      name: "auth",
      component: AuthPage,
    },
    {
      path: "/app",
      component: AppShell,
      meta: { requiresAuth: true },
      children: [
        {
          path: "",
          redirect: "/app/home",
        },
        {
          path: "home",
          name: "home",
          component: HomePage,
          meta: { requiresAuth: true, title: "首页" },
        },
        {
          path: "test",
          name: "test",
          component: MainPage,
          meta: { requiresAuth: true, title: "测试页" },
        },
        {
          path: "settings",
          name: "settings",
          component: SettingsPage,
          meta: { requiresAuth: true, title: "设置" },
        },
      ],
    },
    {
      path: "/:pathMatch(.*)*",
      redirect: "/",
    },
  ],
});

router.beforeEach((to) => {
  if (to.meta.requiresAuth && !isAuthenticated.value) {
    return { path: "/auth", query: { next: to.fullPath } };
  }

  if (to.path === "/auth" && isAuthenticated.value) {
    const next = typeof to.query.next === "string" ? to.query.next : "/app/home";
    return { path: next };
  }

  return true;
});

export default router;
