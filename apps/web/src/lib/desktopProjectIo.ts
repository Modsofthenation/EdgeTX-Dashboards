/** Tauri helpers for saving/opening project packs on disk. */

export async function isTauriDesktop(): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Boolean((window as any).__TAURI_INTERNALS__);
  } catch {
    return false;
  }
}

export async function saveProjectPackToDisk(
  defaultName: string,
  json: string,
): Promise<{ path: string } | { cancelled: true } | { error: string }> {
  try {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { invoke } = await import("@tauri-apps/api/core");
    const path = await save({
      defaultPath: `${defaultName.replace(/[^\w.-]+/g, "_") || "dashboard"}.edgetx-project.json`,
      filters: [
        {
          name: "EdgeTX project",
          extensions: ["edgetx-project.json", "json"],
        },
      ],
      title: "Save project pack",
    });
    if (typeof path !== "string" || !path) return { cancelled: true };
    await invoke("write_text_file", { path, contents: json });
    return { path };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function openProjectPackFromDisk(): Promise<
  { json: string; path: string } | { cancelled: true } | { error: string }
> {
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { invoke } = await import("@tauri-apps/api/core");
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: "EdgeTX project",
          extensions: ["edgetx-project.json", "json"],
        },
      ],
      title: "Open project pack",
    });
    if (typeof selected !== "string" || !selected) return { cancelled: true };
    const json = await invoke<string>("read_text_file", { path: selected });
    return { json, path: selected };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
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
