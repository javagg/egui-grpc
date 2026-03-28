import { createRouter, createWebHistory } from "vue-router";
import { isAuthenticated } from "../auth/session";
import AuthPage from "../views/AuthPage.vue";
import MainPage from "../views/MainPage.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "main",
      component: MainPage,
      meta: { requiresAuth: true },
    },
    {
      path: "/auth",
      name: "auth",
      component: AuthPage,
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
    return { path: "/" };
  }

  return true;
});

export default router;
