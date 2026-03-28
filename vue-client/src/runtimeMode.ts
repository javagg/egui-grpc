import type { AppMode } from "./auth/session";

function normalizeMode(value: string | undefined): AppMode {
  return value?.trim().toLowerCase() === "remote" ? "remote" : "local";
}

export const RUNTIME_MODE: AppMode = normalizeMode(import.meta.env.VITE_APP_MODE);

export const IS_LOCAL_FIRST = RUNTIME_MODE === "local";
