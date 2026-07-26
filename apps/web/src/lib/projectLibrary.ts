/** Project library — named boards + recent list (localStorage, desktop-friendly). */

export interface ProjectSummary {
  id: string;
  name: string;
  protocol: string;
  updatedAt: string;
  workspaceKey?: string;
  sessionId?: string;
  sourcePreview?: string;
}

const STORAGE_KEY = "edgetx.projectLibrary.v1";
const LAST_OPEN_KEY = "edgetx.projectLibrary.lastOpen";
const MAX_RECENT = 12;

export interface ProjectLibraryState {
  projects: ProjectSummary[];
  lastOpenId: string | null;
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

export function markProjectOpened(id: string) {
  const existing = getProject(id);
  if (!existing) return;
  upsertProject({ ...existing, updatedAt: new Date().toISOString() });
}

export function clearLastOpenProject() {
  localStorage.removeItem(LAST_OPEN_KEY);
}

/** Full board payload for named save (source kept separately in sessionStorage). */
const SOURCE_PREFIX = "edgetx.projectSource.";

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

export function newProjectId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `proj-${Date.now()}`;
}
