/** Tauri helpers for saving/opening project packs on disk. */

export async function isTauriDesktop(): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Boolean((window as any).__TAURI_INTERNALS__);
  } catch {
    return false;
  }
}

export interface AppDataProjectFile {
  fileName: string;
  path: string;
  modifiedMs: number;
}

export async function listAppDataProjects(): Promise<AppDataProjectFile[]> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<AppDataProjectFile[]>("list_app_data_projects");
}

export async function readAppDataProject(fileName: string): Promise<string> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("read_app_data_project", { fileName });
}

export async function deleteAppDataProject(fileName: string): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke<void>("delete_app_data_project", { fileName });
}

export function appDataProjectFileName(projectId: string): string {
  const safeId = projectId.replace(/[^\w.-]+/g, "_") || "dashboard";
  return `${safeId}.edgetx-project.json`;
}

export async function saveProjectPackToDisk(
  defaultName: string,
  json: string,
): Promise<{ path: string } | { cancelled: true } | { error: string }> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const path = await invoke<string | null>("save_text_with_dialog", {
      contents: json,
      defaultName: `${defaultName.replace(/[^\w.-]+/g, "_") || "dashboard"}.edgetx-project.json`,
      filterName: "EdgeTX project",
      extensions: ["edgetx-project.json", "json"],
    });
    if (typeof path !== "string" || !path) return { cancelled: true };
    return { path };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function openProjectPackFromDisk(): Promise<
  { json: string; path: string } | { cancelled: true } | { error: string }
> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const picked = await invoke<{ path: string; contents: string } | null>(
      "open_text_with_dialog",
      {
        filterName: "EdgeTX project",
        extensions: ["edgetx-project.json", "json"],
      },
    );
    if (!picked || typeof picked.contents !== "string") {
      return { cancelled: true };
    }
    return { json: picked.contents, path: picked.path };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/** Persist an id-keyed pack under the desktop app data `projects/` folder. */
export async function saveProjectPackToAppData(
  projectId: string,
  json: string,
): Promise<{ path: string } | { error: string }> {
  return syncProjectPackToAppData(appDataProjectFileName(projectId), json);
}

/** Persist pack under the desktop app data `projects/` folder. */
export async function syncProjectPackToAppData(
  fileName: string,
  json: string,
): Promise<{ path: string } | { error: string }> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const path = await invoke<string>("write_app_data_project", {
      fileName,
      contents: json,
    });
    return { path };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
