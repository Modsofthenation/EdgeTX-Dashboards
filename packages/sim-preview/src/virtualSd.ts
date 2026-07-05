/** Minimal 1×1 PNG for MODELS/model.png (Bitmap.open paths). */
export const PLACEHOLDER_MODEL_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0xda, 0x63, 0xf8, 0xcf, 0xc0, 0x50,
  0x0f, 0x00, 0x04, 0x85, 0x01, 0x80, 0x84, 0xa9, 0x8c, 0x21, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
  0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

const WIDGET_NAME_RE = /name\s*=\s*["']([^"']+)["']/;

/** Parse widget `name` from Lua source (EdgeTX internal name, max 10 chars). */
export function extractWidgetName(source: string): string | null {
  const match = source.match(WIDGET_NAME_RE);
  return match?.[1]?.trim() ?? null;
}

/** Sanitize folder name for WIDGETS/<Name>/ on virtual SD. */
export function sanitizeWidgetFolderName(name: string): string {
  const trimmed = name.trim();
  if (!/^[A-Za-z0-9_]{1,10}$/.test(trimmed)) {
    throw new Error(
      `Invalid widget name "${name}": use 1–10 characters (letters, digits, underscore only)`
    );
  }
  return trimmed;
}

export interface VirtualSdPaths {
  widgetDir: string;
  luaPath: string;
  modelPngPath: string;
}

/** OPFS / WASI paths for minimal widget boot layout. */
export function buildVirtualSdPaths(widgetFolderName: string): VirtualSdPaths {
  const safe = sanitizeWidgetFolderName(widgetFolderName);
  return {
    widgetDir: `/WIDGETS/${safe}`,
    luaPath: `/WIDGETS/${safe}/main.lua`,
    modelPngPath: "/MODELS/model.png",
  };
}

export interface WidgetDeployPlan {
  folderName: string;
  widgetName: string;
  paths: VirtualSdPaths;
  luaBytes: Uint8Array;
}

/** Build deploy plan from Lua source; falls back to folderName when name field missing. */
export function planWidgetDeploy(source: string, fallbackFolderName?: string): WidgetDeployPlan {
  const parsedName = extractWidgetName(source);
  const folderName = sanitizeWidgetFolderName(parsedName ?? fallbackFolderName ?? "Widget");
  const widgetName = parsedName ? sanitizeWidgetFolderName(parsedName) : folderName;
  return {
    folderName,
    widgetName,
    paths: buildVirtualSdPaths(folderName),
    luaBytes: new TextEncoder().encode(source),
  };
}
