import { computed, reactive } from "vue";
import { authSession } from "../auth/session";

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
}

const STORAGE_KEY = "grpc-demo-projects";

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

function sanitizeProject(raw: Partial<Project>): Project | null {
  const id = typeof raw.id === "string" && raw.id.length > 0 ? raw.id : safeUuid();
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const description = typeof raw.description === "string" ? raw.description : "";
  const ownerUserId = typeof raw.ownerUserId === "string" ? normalizeUserId(raw.ownerUserId) : "";
  const createdAt = typeof raw.createdAt === "string" && raw.createdAt.length > 0 ? raw.createdAt : new Date().toISOString();
  const updatedAt = typeof raw.updatedAt === "string" && raw.updatedAt.length > 0 ? raw.updatedAt : createdAt;

  if (name.length === 0 || ownerUserId.length === 0) {
    return null;
  }

  const members = Array.isArray(raw.memberUserIds)
    ? raw.memberUserIds.filter((item): item is string => typeof item === "string")
    : [];

  return {
    id,
    name,
    description,
    ownerUserId,
    memberUserIds: normalizeMembers(ownerUserId, members),
    createdAt,
    updatedAt,
  };
}

function loadProjects(): Project[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as { projects?: Partial<Project>[] };
    const source = Array.isArray(parsed.projects) ? parsed.projects : [];
    return source
      .map((item) => sanitizeProject(item))
      .filter((item): item is Project => item !== null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

const projectState = reactive<ProjectState>({
  projects: loadProjects(),
});

function persistProjects(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ projects: projectState.projects }));
}

function sortByRecent(items: Project[]): Project[] {
  return [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export const allProjects = computed(() => projectState.projects);

export const currentUserProjects = computed(() => {
  const currentUserId = normalizeUserId(authSession.currentUser);
  if (currentUserId.length === 0) {
    return [];
  }

  return projectState.projects.filter((project) => project.memberUserIds.includes(currentUserId));
});

export const currentUserRecentProjects = computed(() => currentUserProjects.value.slice(0, 5));

export const currentUserProjectCount = computed(() => currentUserProjects.value.length);

export function createProject(input: ProjectInput): Project {
  const ownerUserId = normalizeUserId(input.ownerUserId);
  const name = input.name.trim();
  const description = input.description.trim();

  if (ownerUserId.length === 0) {
    throw new Error("ownerUserId must not be empty");
  }

  if (name.length === 0) {
    throw new Error("name must not be empty");
  }

  const now = new Date().toISOString();
  const project: Project = {
    id: safeUuid(),
    name,
    description,
    ownerUserId,
    memberUserIds: normalizeMembers(ownerUserId, input.memberUserIds),
    createdAt: now,
    updatedAt: now,
  };

  projectState.projects = sortByRecent([project, ...projectState.projects]);
  persistProjects();
  return project;
}

export function updateProject(
  projectId: ProjectId,
  input: { name: string; description: string; ownerUserId: string; memberUserIds?: string[] },
): Project {
  const index = projectState.projects.findIndex((item) => item.id === projectId);
  if (index < 0) {
    throw new Error("project not found");
  }

  const ownerUserId = normalizeUserId(input.ownerUserId);
  const name = input.name.trim();
  const description = input.description.trim();

  if (ownerUserId.length === 0) {
    throw new Error("ownerUserId must not be empty");
  }

  if (name.length === 0) {
    throw new Error("name must not be empty");
  }

  const existing = projectState.projects[index];
  const updated: Project = {
    ...existing,
    name,
    description,
    ownerUserId,
    memberUserIds: normalizeMembers(ownerUserId, input.memberUserIds),
    updatedAt: new Date().toISOString(),
  };

  const clone = [...projectState.projects];
  clone[index] = updated;
  projectState.projects = sortByRecent(clone);
  persistProjects();
  return updated;
}

export function deleteProject(projectId: ProjectId): void {
  projectState.projects = projectState.projects.filter((item) => item.id !== projectId);
  persistProjects();
}

export function getProjectById(projectId: ProjectId): Project | undefined {
  return projectState.projects.find((item) => item.id === projectId);
}
