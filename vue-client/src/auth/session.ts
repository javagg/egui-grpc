import { computed, reactive } from "vue";

export type AppMode = "remote" | "local";

interface StoredSession {
  token: string;
  currentUser: string;
  isSuperuser: boolean;
  mode: AppMode;
  endpoint: string;
}

const STORAGE_KEY = "grpc-demo-auth-session";

const defaultSession: StoredSession = {
  token: "",
  currentUser: "",
  isSuperuser: false,
  mode: "local",
  endpoint: "http://127.0.0.1:50051",
};

function sanitizeMode(mode: unknown): AppMode {
  return mode === "local" ? "local" : "remote";
}

function loadSession(): StoredSession {
  if (typeof window === "undefined") {
    return { ...defaultSession };
  }

  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { ...defaultSession };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    return {
      token: parsed.token ?? "",
      currentUser: parsed.currentUser ?? "",
      isSuperuser: Boolean(parsed.isSuperuser),
      mode: sanitizeMode(parsed.mode),
      endpoint: parsed.endpoint ?? defaultSession.endpoint,
    };
  } catch {
    return { ...defaultSession };
  }
}

export const authSession = reactive<StoredSession>(loadSession());

export const isAuthenticated = computed(() => authSession.token.length > 0);

function persistSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(authSession));
}

export function setAuthSession(input: {
  token: string;
  currentUser: string;
  isSuperuser: boolean;
  mode: AppMode;
  endpoint: string;
}): void {
  authSession.token = input.token;
  authSession.currentUser = input.currentUser;
  authSession.isSuperuser = input.isSuperuser;
  authSession.mode = input.mode;
  authSession.endpoint = input.endpoint;
  persistSession();
}

export function updateAuthConfig(input: { mode?: AppMode; endpoint?: string }): void {
  if (input.mode) {
    authSession.mode = input.mode;
  }
  if (typeof input.endpoint === "string") {
    authSession.endpoint = input.endpoint;
  }
  persistSession();
}

export function clearAuthSession(options?: { preserveConfig?: boolean }): void {
  const preserveConfig = options?.preserveConfig ?? false;
  const mode = preserveConfig ? authSession.mode : defaultSession.mode;
  const endpoint = preserveConfig ? authSession.endpoint : defaultSession.endpoint;

  authSession.token = "";
  authSession.currentUser = "";
  authSession.isSuperuser = false;
  authSession.mode = mode;
  authSession.endpoint = endpoint;

  if (typeof window !== "undefined") {
    if (preserveConfig) {
      persistSession();
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  }
}
