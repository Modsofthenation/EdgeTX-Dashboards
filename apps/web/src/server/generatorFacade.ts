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
  getGeneratedDir,
  getLayoutProfileId,
  getRepoRoot,
  getSessionStore,
  getWidgetLuaPath,
  isTelemetryProtocol,
  listAvailableModels,
  listRadioProfiles,
  MAX_ACTIVE_SESSIONS,
  packageWidget,
  sanitizeWidgetName,
  validateGenerateRequest,
  validateWidgetForRelease,
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
  isTelemetryProtocol,
  WidgetValidationError,
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

export function resolveWidgetNameFromSession(
  sessionId: string | null,
  explicitName: string | null
): { name?: string; pending?: boolean } {
  let name = explicitName?.trim() || undefined;

  if (sessionId && !name) {
    const stored = getSessionStore().get(sessionId);
    name = stored?.session.widgetName ?? undefined;
  }

  if (!name) return { pending: true };
  return { name };
}

export function readWidgetLuaSource(name: string): { source: string; name: string } | null {
  const safeName = sanitizeWidgetName(name);
  const path = getWidgetLuaPath(safeName);
  if (!existsSync(path)) return null;
  return { source: readFileSync(path, "utf-8"), name: safeName };
}

/** Write chat snapshot back to generated/ before refine (each chat may share a widget folder name). */
export function writeWidgetLuaSource(name: string, source: string): void {
  const safeName = sanitizeWidgetName(name);
  mkdirSync(getGeneratedDir(safeName), { recursive: true });
  writeFileSync(getWidgetLuaPath(safeName), source, "utf-8");
}

export async function readOrBuildWidgetZip(
  safeName: string,
  protocol: Parameters<typeof packageWidget>[1],
  radioId: string
): Promise<Buffer | null> {
  const distZip = join(getDistOutputDirectory(), `${safeName}.zip`);
  if (!existsSync(distZip)) {
    await packageWidget(safeName, protocol, { radioId });
  }
  if (!existsSync(distZip)) return null;
  return readFileSync(distZip);
}

export function validateWidgetRelease(
  name: string,
  protocol: Parameters<typeof validateWidgetForRelease>[1],
  radioId: string
) {
  return validateWidgetForRelease(name, protocol, { radioId, strictTelemetry: true });
}

export { findLatestWidgetName, sanitizeWidgetName };
