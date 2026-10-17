import { createDraft, type ProjectDraft, type ProjectStatus, type StepId } from "@/lib/projects/draft";

export const PROJECTS_KEY = "bridgify.projects.v1";
export const PROJECTS_EVENT = "bridgify-projects";

export type StoreFailure = { ok: false; error: string };
export type StoreSuccess<T> = { ok: true; data: T };
export type StoreResult<T> = StoreSuccess<T> | StoreFailure;

const STATUSES: ProjectStatus[] = ["draft", "active", "completed", "archived"];

function storageError() {
  return "Saved projects could not be read on this device. Retry, or check that browser storage is available.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStep(value: unknown): value is StepId {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

export function isProjectDraft(value: unknown): value is ProjectDraft {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string" || !value.id) return false;
  if (!STATUSES.includes(value.status as ProjectStatus)) return false;
  if (!isStep(value.step)) return false;
  if (!isRecord(value.basics) || !isRecord(value.agreement) || !isRecord(value.people)) return false;
  if (!isRecord(value.automation) || !isRecord(value.review)) return false;
  if (!Array.isArray(value.agreement.items) || !Array.isArray(value.people.bindings)) return false;
  return true;
}

export function parseStoredProjects(raw: string | null): StoreResult<ProjectDraft[]> {
  if (!raw) return { ok: true, data: [] };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { ok: false, error: storageError() };
    const projects = parsed.filter(isProjectDraft);
    if (projects.length !== parsed.length) return { ok: false, error: storageError() };
    return { ok: true, data: projects };
  } catch {
    return { ok: false, error: storageError() };
  }
}

export function readProjects(): StoreResult<ProjectDraft[]> {
  if (typeof window === "undefined") return { ok: true, data: [] };
  try {
    return parseStoredProjects(window.localStorage.getItem(PROJECTS_KEY));
  } catch {
    return { ok: false, error: storageError() };
  }
}

export function writeProjects(projects: ProjectDraft[]): StoreResult<ProjectDraft[]> {
  if (typeof window === "undefined") return { ok: false, error: storageError() };
  try {
    window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    window.dispatchEvent(new Event(PROJECTS_EVENT));
    return { ok: true, data: projects };
  } catch {
    return { ok: false, error: "The draft could not be saved. Free some space in browser storage and try again." };
  }
}

export function upsertProject(project: ProjectDraft): StoreResult<ProjectDraft> {
  const current = readProjects();
  if (!current.ok) return current;
  const next = current.data.some((item) => item.id === project.id)
    ? current.data.map((item) => (item.id === project.id ? project : item))
    : [project, ...current.data];
  const saved = writeProjects(next);
  if (!saved.ok) return saved;
  return { ok: true, data: project };
}

export function getProject(id: string): StoreResult<ProjectDraft | null> {
  const current = readProjects();
  if (!current.ok) return current;
  return { ok: true, data: current.data.find((project) => project.id === id) ?? null };
}

export function createSavedDraft(): StoreResult<ProjectDraft> {
  const draft = createDraft();
  draft.savedAt = new Date().toISOString();
  return upsertProject(draft);
}
