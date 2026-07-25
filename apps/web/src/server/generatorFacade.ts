/**
 * Narrow server seam for web API routes → @widget-gen/generator.
 * Import generator symbols here only — not from individual route files.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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

export async function listModelCatalog() {
  if (!process.env.CURSOR_API_KEY) {
    return {
      defaultId: DEFAULT_MODEL_ID,
      models: FALLBACK_MODELS,
      source: "fallback" as const,
    };
  }

  const models = await listAvailableModels();
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

export { findLatestWidgetName, sanitizeWidgetName };
