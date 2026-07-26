/**
 * Narrow server seam for web API routes → @widget-gen/generator.
 * Import generator symbols here only — not from individual route files.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  CursorAgentError,
  DEFAULT_MODEL_ID,
  FALLBACK_MODELS,
  findLatestWidgetName,
  getDefaultModelId,
  getGeneratedDirForKey,
  getLayoutProfileId,
  getRepoRoot,
  getSessionStore,
  getWidgetLuaPathForKey,
  isTelemetryProtocol,
  isWidgetInstanceId,
  listAvailableModels,
  listRadioProfiles,
  MAX_ACTIVE_SESSIONS,
  packageWidget,
  readWidgetInstanceMeta,
  readWidgetVersionSource,
  resolveDisplayName,
  sanitizeWidgetInstanceId,
  sanitizeWidgetName,
  validateGenerateRequest,
  validatePromptImages,
  validateWidgetForRelease,
  validateWidgetSource,
  WidgetValidationError,
  listWidgetPackageEntries,
} from "@widget-gen/generator";

export {
  CursorAgentError,
  DEFAULT_MODEL_ID,
  FALLBACK_MODELS,
  getDefaultModelId,
  getSessionStore,
  MAX_ACTIVE_SESSIONS,
  validateGenerateRequest,
  validatePromptImages,
  isTelemetryProtocol,
  WidgetValidationError,
  isWidgetInstanceId,
  sanitizeWidgetInstanceId,
  validateWidgetSource,
};

export function getDataDirectory(): string {
  return process.env.WIDGET_GEN_DATA_DIR ?? join(getRepoRoot(), "data");
}

export function getDistOutputDirectory(): string {
  return join(getRepoRoot(), "dist-output");
}

export async function listModelCatalog(apiKey?: string) {
  const key = apiKey ?? process.env.CURSOR_API_KEY;
  if (!key) {
    return {
      defaultId: DEFAULT_MODEL_ID,
      models: FALLBACK_MODELS,
      source: "fallback" as const,
    };
  }

  const models = await listAvailableModels(apiKey);
  const usingFallback =
    models.length === FALLBACK_MODELS.length &&
    models.every((model, index) => model.id === FALLBACK_MODELS[index]?.id);

  return {
    defaultId: getDefaultModelId(models),
    models,
    source: usingFallback ? ("fallback" as const) : ("api" as const),
  };
}

export function listRadioCatalog() {
  return listRadioProfiles().map((radio) => ({
    id: radio.id,
    name: radio.name,
    lcdW: radio.lcdW,
    lcdH: radio.lcdH,
    touch: radio.touch,
    layoutProfile: getLayoutProfileId(radio),
  }));
}

export interface ResolvedWidgetWorkspace {
  workspaceKey: string;
  displayName?: string;
  version?: number;
  pending?: boolean;
}

function normalizeWorkspaceKey(key: string): string {
  return isWidgetInstanceId(key)
    ? sanitizeWidgetInstanceId(key)
    : sanitizeWidgetName(key);
}

export function resolveWidgetWorkspaceFromSession(
  sessionId: string | null,
  explicitInstanceId: string | null,
  explicitName: string | null,
): ResolvedWidgetWorkspace {
  let workspaceKey = explicitInstanceId?.trim() || undefined;
  let displayName = explicitName?.trim() || undefined;
  let version: number | undefined;

  if (sessionId && !workspaceKey) {
    const stored = getSessionStore().get(sessionId);
    workspaceKey = stored?.session.widgetInstanceId ?? undefined;
    displayName = displayName ?? stored?.session.widgetName ?? undefined;
    version = stored?.session.widgetVersion;
  }

  if (!workspaceKey && displayName) {
    workspaceKey = displayName;
  }

  if (!workspaceKey) return { workspaceKey: "", pending: true };

  const key = normalizeWorkspaceKey(workspaceKey);
  if (isWidgetInstanceId(key)) {
    const meta = readWidgetInstanceMeta(key);
    return {
      workspaceKey: key,
      displayName: meta?.displayName ?? resolveDisplayName(key) ?? displayName,
      version: meta?.version ?? version,
    };
  }

  return { workspaceKey: key, displayName, version };
}

export function readWidgetLuaSource(
  workspaceKey: string,
  version?: number,
): {
  source: string;
  name: string;
  instanceId: string | null;
  version: number;
} | null {
  const key = normalizeWorkspaceKey(workspaceKey);

  if (isWidgetInstanceId(key) && version !== undefined) {
    const source = readWidgetVersionSource(key, version);
    if (!source) return null;
    const meta = readWidgetInstanceMeta(key);
    const displayName = meta?.displayName ?? resolveDisplayName(key) ?? key;
    return { source, name: displayName, instanceId: key, version };
  }

  const path = getWidgetLuaPathForKey(key);
  if (!existsSync(path)) return null;

  const meta = isWidgetInstanceId(key) ? readWidgetInstanceMeta(key) : null;
  const displayName = meta?.displayName ?? resolveDisplayName(key) ?? key;

  return {
    source: readFileSync(path, "utf-8"),
    name: displayName,
    instanceId: isWidgetInstanceId(key) ? key : null,
    version: meta?.version ?? version ?? 0,
  };
}

/** Write chat snapshot back to generated/ before refine (each chat has its own UUID workspace). */
export function writeWidgetLuaSource(
  workspaceKey: string,
  source: string,
): void {
  const key = normalizeWorkspaceKey(workspaceKey);
  mkdirSync(getGeneratedDirForKey(key), { recursive: true });
  writeFileSync(getWidgetLuaPathForKey(key), source, "utf-8");
}

/**
 * Write companion scripts / model images under generated/<key>/.
 * Rel paths must be tools/*.lua, telemetry/*.lua, or images/*.(png|PNG)
 * (no traversal). Image content may be base64 when encoding is "base64".
 */
export function writeWidgetCompanionFiles(
  workspaceKey: string,
  files: {
    relPath: string;
    content: string;
    encoding?: "utf8" | "base64";
  }[],
): string[] {
  const key = normalizeWorkspaceKey(workspaceKey);
  const root = getGeneratedDirForKey(key);
  mkdirSync(root, { recursive: true });
  const written: string[] = [];
  for (const file of files) {
    const rel = file.relPath.replace(/\\/g, "/").replace(/^\/+/, "");
    if (rel.includes("..")) {
      throw new Error(`Refusing companion path: ${file.relPath}`);
    }
    const isLua =
      (rel.startsWith("tools/") || rel.startsWith("telemetry/")) &&
      rel.endsWith(".lua");
    const isImage =
      (rel.startsWith("images/") || rel.startsWith("IMAGES/")) &&
      /\.png$/i.test(rel);
    if (!isLua && !isImage) {
      throw new Error(`Refusing companion path: ${file.relPath}`);
    }
    const dest = join(root, rel.replace(/^IMAGES\//, "images/"));
    mkdirSync(dirname(dest), { recursive: true });
    if (isImage && file.encoding === "base64") {
      writeFileSync(dest, Buffer.from(file.content, "base64"));
    } else {
      writeFileSync(dest, file.content, "utf-8");
    }
    written.push(rel.replace(/^IMAGES\//, "images/"));
  }
  return written;
}

export async function readOrBuildWidgetZip(
  workspaceKey: string,
  protocol: Parameters<typeof packageWidget>[1],
  radioId: string,
  version?: number,
): Promise<{ buffer: Buffer; downloadName: string } | null> {
  const key = normalizeWorkspaceKey(workspaceKey);
  const zipBaseName = isWidgetInstanceId(key) ? key : sanitizeWidgetName(key);
  const distZip =
    version !== undefined
      ? join(getDistOutputDirectory(), `${zipBaseName}-v${version}.zip`)
      : join(getDistOutputDirectory(), `${zipBaseName}.zip`);
  if (!existsSync(distZip)) {
    await packageWidget(key, protocol, { radioId, version });
  }
  if (!existsSync(distZip)) return null;

  const displayName =
    resolveDisplayName(key) ??
    (isWidgetInstanceId(key) ? key : sanitizeWidgetName(key));
  const downloadName =
    version !== undefined
      ? `${sanitizeWidgetName(displayName)}-v${version}`
      : sanitizeWidgetName(displayName);
  return {
    buffer: readFileSync(distZip),
    downloadName,
  };
}

export function validateWidgetRelease(
  workspaceKey: string,
  protocol: Parameters<typeof validateWidgetForRelease>[1],
  radioId: string,
) {
  return validateWidgetForRelease(
    normalizeWorkspaceKey(workspaceKey),
    protocol,
    {
      radioId,
      strictTelemetry: true,
    },
  );
}

/** SD-relative file list for desktop install wizard (WIDGETS/ + SCRIPTS/). */
export function listWidgetSdFiles(
  workspaceKey: string,
): { path: string; content: string; encoding: "utf8" | "base64" }[] {
  const key = normalizeWorkspaceKey(workspaceKey);
  const entries = listWidgetPackageEntries(key);
  return entries.map((entry) => {
    const buf = readFileSync(entry.filePath);
    const isText = /\.(lua|md|txt|json|yml|yaml|csv)$/i.test(entry.zipPath);
    if (isText) {
      return {
        path: entry.zipPath,
        content: buf.toString("utf-8"),
        encoding: "utf8" as const,
      };
    }
    return {
      path: entry.zipPath,
      content: buf.toString("base64"),
      encoding: "base64" as const,
    };
  });
}

export { findLatestWidgetName, sanitizeWidgetName };
