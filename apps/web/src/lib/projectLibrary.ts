/** Project library — named boards + recent list (localStorage, desktop-friendly). */

import type {
  CompanionSdFile,
  EditorCompanionState,
} from "~/lib/companionSuites";

export interface ProjectSummary {
  id: string;
  name: string;
  protocol: string;
  updatedAt: string;
  workspaceKey?: string;
  sessionId?: string;
  sourcePreview?: string;
  radioId?: string;
  layoutProfileId?: string;
}

export interface ProjectNamedVersion {
  id: string;
  name: string;
  createdAt: string;
  source: string;
}

const STORAGE_KEY = "edgetx.projectLibrary.v1";
const LAST_OPEN_KEY = "edgetx.projectLibrary.lastOpen";
const MAX_RECENT = 12;
const MAX_NAMED_VERSIONS = 20;
const SOURCE_PREFIX = "edgetx.projectSource.";
const COMPANIONS_PREFIX = "edgetx.projectCompanions.";
const MODEL_PREFIX = "edgetx.projectModel.";
const VERSIONS_PREFIX = "edgetx.projectVersions.";
export const PROJECT_PACK_FORMAT = "edgetx-dashboard-project";
export const PROJECT_PACK_VERSION = 2;

export interface ProjectLibraryState {
  projects: ProjectSummary[];
  lastOpenId: string | null;
}

export interface ProjectPack {
  format: typeof PROJECT_PACK_FORMAT;
  version: typeof PROJECT_PACK_VERSION | 1;
  exportedAt: string;
  project: Omit<ProjectSummary, "updatedAt" | "sourcePreview"> & {
    updatedAt?: string;
    sourcePreview?: string;
  };
  source: string;
  companions?: EditorCompanionState;
  modelImage?: CompanionSdFile;
  versions?: ProjectNamedVersion[];
}

function readRaw(): ProjectLibraryState {
  if (typeof window === "undefined") {
    return { projects: [], lastOpenId: null };
  }
  try {
    const parsed = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? '{"projects":[]}',
    ) as { projects?: ProjectSummary[] };
    const lastOpenId = localStorage.getItem(LAST_OPEN_KEY);
    return {
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      lastOpenId,
    };
  } catch {
    return { projects: [], lastOpenId: null };
  }
}

function writeProjects(projects: ProjectSummary[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ projects }));
}

export function listRecentProjects(): ProjectSummary[] {
  return readRaw()
    .projects.slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getLastOpenProjectId(): string | null {
  return readRaw().lastOpenId;
}

export function getProject(id: string): ProjectSummary | undefined {
  return readRaw().projects.find((p) => p.id === id);
}

export function upsertProject(
  project: Omit<ProjectSummary, "updatedAt"> & { updatedAt?: string },
): ProjectSummary {
  const next: ProjectSummary = {
    ...project,
    updatedAt: project.updatedAt ?? new Date().toISOString(),
  };
  const state = readRaw();
  const without = state.projects.filter((p) => p.id !== next.id);
  const projects = [next, ...without].slice(0, MAX_RECENT);
  writeProjects(projects);
  localStorage.setItem(LAST_OPEN_KEY, next.id);
  return next;
}

export function renameProject(id: string, name: string): ProjectSummary | null {
  const existing = getProject(id);
  if (!existing) return null;
  const trimmed = name.trim();
  if (!trimmed) return existing;
  return upsertProject({ ...existing, name: trimmed });
}

export function deleteProject(id: string): void {
  const state = readRaw();
  writeProjects(state.projects.filter((p) => p.id !== id));
  if (state.lastOpenId === id) {
    localStorage.removeItem(LAST_OPEN_KEY);
  }
  try {
    sessionStorage.removeItem(`${SOURCE_PREFIX}${id}`);
    localStorage.removeItem(`${SOURCE_PREFIX}${id}`);
    localStorage.removeItem(`${COMPANIONS_PREFIX}${id}`);
    localStorage.removeItem(`${MODEL_PREFIX}${id}`);
    localStorage.removeItem(`${VERSIONS_PREFIX}${id}`);
  } catch {
    /* ignore */
  }
}

export function markProjectOpened(id: string) {
  const existing = getProject(id);
  if (!existing) return;
  upsertProject({ ...existing, updatedAt: new Date().toISOString() });
}

export function clearLastOpenProject() {
  localStorage.removeItem(LAST_OPEN_KEY);
}

export function saveProjectSource(id: string, source: string) {
  try {
    sessionStorage.setItem(`${SOURCE_PREFIX}${id}`, source);
    localStorage.setItem(`${SOURCE_PREFIX}${id}`, source);
  } catch {
    // quota — keep metadata only
  }
}

export function loadProjectSource(id: string): string | null {
  try {
    return (
      sessionStorage.getItem(`${SOURCE_PREFIX}${id}`) ??
      localStorage.getItem(`${SOURCE_PREFIX}${id}`)
    );
  } catch {
    return null;
  }
}

export function saveProjectCompanions(
  id: string,
  companions: EditorCompanionState,
): void {
  try {
    localStorage.setItem(
      `${COMPANIONS_PREFIX}${id}`,
      JSON.stringify(companions),
    );
  } catch {
    /* ignore */
  }
}

export function loadProjectCompanions(id: string): EditorCompanionState | null {
  try {
    const raw = localStorage.getItem(`${COMPANIONS_PREFIX}${id}`);
    if (!raw) return null;
    return JSON.parse(raw) as EditorCompanionState;
  } catch {
    return null;
  }
}

export function saveProjectModelImage(
  id: string,
  modelImage: CompanionSdFile | null,
): void {
  try {
    if (!modelImage) {
      localStorage.removeItem(`${MODEL_PREFIX}${id}`);
      return;
    }
    localStorage.setItem(`${MODEL_PREFIX}${id}`, JSON.stringify(modelImage));
  } catch {
    /* ignore */
  }
}

export function loadProjectModelImage(id: string): CompanionSdFile | null {
  try {
    const raw = localStorage.getItem(`${MODEL_PREFIX}${id}`);
    if (!raw) return null;
    return JSON.parse(raw) as CompanionSdFile;
  } catch {
    return null;
  }
}

export function listProjectVersions(id: string): ProjectNamedVersion[] {
  try {
    const raw = localStorage.getItem(`${VERSIONS_PREFIX}${id}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ProjectNamedVersion[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeProjectVersions(id: string, versions: ProjectNamedVersion[]) {
  localStorage.setItem(`${VERSIONS_PREFIX}${id}`, JSON.stringify(versions));
}

export function saveNamedVersion(
  projectId: string,
  name: string,
  source: string,
): ProjectNamedVersion {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `ver-${Date.now()}`;
  const entry: ProjectNamedVersion = {
    id,
    name: name.trim() || "Version",
    createdAt: new Date().toISOString(),
    source,
  };
  const next = [entry, ...listProjectVersions(projectId)].slice(
    0,
    MAX_NAMED_VERSIONS,
  );
  writeProjectVersions(projectId, next);
  return entry;
}

export function newProjectId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `proj-${Date.now()}`;
}

export function exportProjectPack(id: string): ProjectPack | null {
  const project = getProject(id);
  const source = loadProjectSource(id);
  if (!project || !source) return null;
  const companions = loadProjectCompanions(id) ?? undefined;
  const modelImage = loadProjectModelImage(id) ?? undefined;
  const versions = listProjectVersions(id);
  return {
    format: PROJECT_PACK_FORMAT,
    version: PROJECT_PACK_VERSION,
    exportedAt: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name,
      protocol: project.protocol,
      workspaceKey: project.workspaceKey,
      sessionId: project.sessionId,
      radioId: project.radioId,
      layoutProfileId: project.layoutProfileId,
    },
    source,
    ...(companions ? { companions } : {}),
    ...(modelImage ? { modelImage } : {}),
    ...(versions.length ? { versions } : {}),
  };
}

export function importProjectPack(raw: unknown):
  | {
      project: ProjectSummary;
      source: string;
      companions?: EditorCompanionState;
      modelImage?: CompanionSdFile;
    }
  | { error: string } {
  if (!raw || typeof raw !== "object") {
    return { error: "Invalid project pack" };
  }
  const pack = raw as Partial<ProjectPack>;
  if (pack.format !== PROJECT_PACK_FORMAT) {
    return { error: "Unrecognized project pack format" };
  }
  if (!pack.source || typeof pack.source !== "string") {
    return { error: "Project pack missing Lua source" };
  }
  const meta = pack.project;
  if (!meta?.name || !meta.protocol) {
    return { error: "Project pack missing name/protocol" };
  }
  const id = newProjectId();
  const project = upsertProject({
    id,
    name: meta.name,
    protocol: meta.protocol,
    workspaceKey: meta.workspaceKey,
    sessionId: meta.sessionId,
    radioId: meta.radioId,
    layoutProfileId: meta.layoutProfileId,
    sourcePreview: pack.source.slice(0, 120),
  });
  saveProjectSource(id, pack.source);
  if (pack.companions) {
    saveProjectCompanions(id, pack.companions);
  }
  if (pack.modelImage) {
    saveProjectModelImage(id, pack.modelImage);
  }
  if (Array.isArray(pack.versions) && pack.versions.length) {
    writeProjectVersions(
      id,
      pack.versions.slice(0, MAX_NAMED_VERSIONS).map((v) => ({
        ...v,
        id: newProjectId(),
      })),
    );
  }
  return {
    project,
    source: pack.source,
    companions: pack.companions,
    modelImage: pack.modelImage,
  };
}

export function downloadProjectPack(id: string): boolean {
  const pack = exportProjectPack(id);
  if (!pack) return false;
  const blob = new Blob([JSON.stringify(pack, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${pack.project.name.replace(/[^\w.-]+/g, "_") || "dashboard"}.edgetx-project.json`;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}
