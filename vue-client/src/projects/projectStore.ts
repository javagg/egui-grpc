import { computed, reactive } from "vue";
import { authSession } from "../auth/session";
import {
  createProject as createProjectRemote,
  deleteProject as deleteProjectRemote,
  listProjects as listProjectsRemote,
  updateProject as updateProjectRemote,
} from "../grpc/grpcWeb";
import { callLocalProjectBackend } from "../local/workerClient";

export type ProjectId = string;

export interface Project {
  id: ProjectId;
  name: string;
  description: string;
  ownerUserId: string;
  memberUserIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectInput {
  name: string;
  description: string;
  ownerUserId: string;
  memberUserIds?: string[];
}

interface ProjectState {
  projects: Project[];
  loading: boolean;
}

interface LocalProjectWire {
  id: string;
  name: string;
  description: string;
  owner_user_id: string;
  member_user_ids: string[];
  created_at: string;
  updated_at: string;
}

interface LocalProjectReply {
  ok: boolean;
  projects: LocalProjectWire[];
  project?: LocalProjectWire;
}

function normalizeUserId(userId: string): string {
  return userId.trim();
}

function normalizeMembers(ownerUserId: string, memberUserIds?: string[]): string[] {
  const normalizedOwner = normalizeUserId(ownerUserId);
  const members = (memberUserIds ?? [])
    .map((item) => normalizeUserId(item))
    .filter((item) => item.length > 0);

  if (!members.includes(normalizedOwner)) {
    members.unshift(normalizedOwner);
  }

  return Array.from(new Set(members));
}

function safeUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const seed = `${Date.now()}-${Math.random()}`;
  return `p-${seed.replace(/[.]/g, "")}`;
}

function toEpoch(value: string): number {
  const numeric = Number(value);
  if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
    return numeric;
  }

  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) {
    return parsed;
  }

  return 0;
}

const projectState = reactive<ProjectState>({
  projects: [],
  loading: false,
});

function sortByRecent(items: Project[]): Project[] {
  return [...items].sort((a, b) => toEpoch(b.updatedAt) - toEpoch(a.updatedAt));
}

function ensureAuthContext(): {
  token: string;
  userId: string;
  isSuperuser: boolean;
  endpoint: string;
  mode: "remote" | "local";
} {
  const token = authSession.token;
  const userId = normalizeUserId(authSession.currentUser);

  if (token.length === 0 || userId.length === 0) {
    throw new Error("not logged in");
  }

  return {
    token,
    userId,
    isSuperuser: authSession.isSuperuser,
    endpoint: authSession.endpoint,
    mode: authSession.mode,
  };
}

function parseLocalReply(raw: string): LocalProjectReply {
  try {
    return JSON.parse(raw) as LocalProjectReply;
  } catch {
    throw new Error("invalid local project reply");
  }
}

function fromLocalProject(item: LocalProjectWire): Project {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    ownerUserId: item.owner_user_id,
    memberUserIds: item.member_user_ids,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

export const allProjects = computed(() => projectState.projects);
export const projectsLoading = computed(() => projectState.loading);

export const currentUserProjects = computed(() => {
  const currentUserId = normalizeUserId(authSession.currentUser);
  if (currentUserId.length === 0) {
    return [];
  }

  return projectState.projects.filter((project) => project.memberUserIds.includes(currentUserId));
});

export const currentUserRecentProjects = computed(() => currentUserProjects.value.slice(0, 5));

export const currentUserProjectCount = computed(() => currentUserProjects.value.length);

export async function refreshProjects(): Promise<Project[]> {
  const { token, userId, mode, endpoint } = ensureAuthContext();
  projectState.loading = true;

  try {
    if (mode === "local") {
      const raw = await callLocalProjectBackend(token, {
        action: "list",
        user_id: userId,
      });
      const parsed = parseLocalReply(raw);
      projectState.projects = sortByRecent((parsed.projects ?? []).map(fromLocalProject));
      return projectState.projects;
    }

    const reply = await listProjectsRemote(endpoint, {}, token);
    projectState.projects = sortByRecent(reply.projects ?? []);
    return projectState.projects;
  } finally {
    projectState.loading = false;
  }
}

export async function createProject(input: ProjectInput): Promise<Project> {
  const { token, userId, mode, endpoint } = ensureAuthContext();
  const ownerUserId = normalizeUserId(input.ownerUserId || userId);
  const memberUserIds = normalizeMembers(ownerUserId, input.memberUserIds);

  if (mode === "local") {
    const raw = await callLocalProjectBackend(token, {
      action: "create",
      id: safeUuid(),
      name: input.name,
      description: input.description,
      owner_user_id: ownerUserId,
      member_user_ids: memberUserIds,
    });
    const parsed = parseLocalReply(raw);
    if (!parsed.project) {
      throw new Error("create project failed");
    }
    const created = fromLocalProject(parsed.project);
    projectState.projects = sortByRecent([created, ...projectState.projects]);
    return created;
  }

  const reply = await createProjectRemote(
    endpoint,
    {
      name: input.name,
      description: input.description,
      memberUserIds,
    },
    token,
  );
  if (!reply.project) {
    throw new Error("create project failed");
  }

  projectState.projects = sortByRecent([reply.project, ...projectState.projects]);
  return reply.project;
}

export async function updateProject(
  projectId: ProjectId,
  input: { name: string; description: string; ownerUserId: string; memberUserIds?: string[] },
): Promise<Project> {
  const { token, userId, mode, endpoint, isSuperuser } = ensureAuthContext();
  const ownerUserId = normalizeUserId(input.ownerUserId);
  const memberUserIds = normalizeMembers(ownerUserId, input.memberUserIds);

  let updated: Project | undefined;

  if (mode === "local") {
    const raw = await callLocalProjectBackend(token, {
      action: "update",
      user_id: userId,
      is_superuser: isSuperuser,
      id: projectId,
      name: input.name,
      description: input.description,
      owner_user_id: ownerUserId,
      member_user_ids: memberUserIds,
    });
    const parsed = parseLocalReply(raw);
    updated = parsed.project ? fromLocalProject(parsed.project) : undefined;
  } else {
    const reply = await updateProjectRemote(
      endpoint,
      {
        id: projectId,
        name: input.name,
        description: input.description,
        ownerUserId,
        memberUserIds,
      },
      token,
    );
    updated = reply.project;
  }

  if (!updated) {
    throw new Error("update project failed");
  }

  projectState.projects = sortByRecent(
    projectState.projects.map((item) => (item.id === projectId ? updated as Project : item)),
  );

  return updated;
}

export async function deleteProject(projectId: ProjectId): Promise<void> {
  const { token, userId, mode, endpoint, isSuperuser } = ensureAuthContext();

  if (mode === "local") {
    await callLocalProjectBackend(token, {
      action: "delete",
      user_id: userId,
      is_superuser: isSuperuser,
      id: projectId,
    });
  } else {
    const reply = await deleteProjectRemote(endpoint, { id: projectId }, token);
    if (!reply.ok) {
      throw new Error("delete project failed");
    }
  }

  projectState.projects = projectState.projects.filter((item) => item.id !== projectId);
}

export function getProjectById(projectId: ProjectId): Project | undefined {
  return projectState.projects.find((item) => item.id === projectId);
}
