/**
 * Save a Blob to disk — uses a Tauri save dialog on desktop,
 * falls back to the browser `<a download>` pattern on web.
 */

import { isTauriDesktop } from "./desktopProjectIo.ts";

export type SaveBlobResult =
  | { ok: true; path?: string }
  | { ok: false; cancelled: true }
  | { ok: false; error: string };

function bytesToBase64(bytes: Uint8Array): string {
  // Chunk to avoid call-stack / argument limits on large zips.
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    for (let j = 0; j < slice.length; j++) {
      binary += String.fromCharCode(slice[j]!);
    }
  }
  return btoa(binary);
}

function triggerBrowserDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function saveBlobToDisk(
  blob: Blob,
  defaultFileName: string,
  options?: {
    title?: string;
    filters?: { name: string; extensions: string[] }[];
  },
): Promise<SaveBlobResult> {
  const safeName =
    defaultFileName.replace(/[^\w.\-]+/g, "_").replace(/^\.+/, "") ||
    "download.bin";

  if (!(await isTauriDesktop())) {
    triggerBrowserDownload(blob, safeName);
    return { ok: true };
  }

  try {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { invoke } = await import("@tauri-apps/api/core");
    const path = await save({
      defaultPath: safeName,
      filters: options?.filters ?? [
        { name: "Zip archive", extensions: ["zip"] },
      ],
      title: options?.title ?? "Save download",
    });
    if (typeof path !== "string" || !path) {
      return { ok: false, cancelled: true };
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    await invoke("write_bytes_file", {
      path,
      contentsBase64: bytesToBase64(bytes),
    });
    return { ok: true, path };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Convenience: fetch a zip URL and save it (desktop dialog / browser download). */
export async function downloadAndSaveZip(
  url: string,
  defaultFileName: string,
): Promise<SaveBlobResult> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return {
      ok: false,
      error: body.error ?? `Download failed (${res.status})`,
    };
  }
  const blob = await res.blob();
  const name = defaultFileName.toLowerCase().endsWith(".zip")
    ? defaultFileName
    : `${defaultFileName}.zip`;
  return saveBlobToDisk(blob, name, {
    title: "Save widget zip",
    filters: [{ name: "Zip archive", extensions: ["zip"] }],
  });
}
