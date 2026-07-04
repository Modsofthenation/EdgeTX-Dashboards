import { createWriteStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import archiver from "archiver";
import type { RadioProfile, TelemetryCatalog, TelemetryProtocol } from "@widget-gen/shared";
import { getRepoRoot, loadTelemetryCatalog, readTemplate, loadRadioProfile } from "./knowledge.js";
import { getGeneratedDir, getWidgetLuaPath, sanitizeWidgetName } from "./paths.js";
import { assertValidForRelease } from "./validationPipeline.js";
import { defaultWorkspace } from "./workspace.js";

export { getGeneratedDir, getWidgetLuaPath, sanitizeWidgetName } from "./paths.js";

export function renderInstallMd(
  widgetName: string,
  radio: RadioProfile,
  catalog: TelemetryCatalog,
  sensorNames: string[]
): string {
  let tpl = readTemplate("INSTALL.md.tpl");
  const sensors = catalog.sensors.filter((s) => sensorNames.includes(s.name));

  tpl = tpl.replace(/\{\{WIDGET_NAME\}\}/g, widgetName);
  tpl = tpl.replace(/\{\{RADIO_NAME\}\}/g, radio.name);
  tpl = tpl.replace(/\{\{LCD_W\}\}/g, String(radio.lcdW));
  tpl = tpl.replace(/\{\{LCD_H\}\}/g, String(radio.lcdH));
  tpl = tpl.replace(/\{\{PROTOCOL_LABEL\}\}/g, catalog.label);

  const setupNotes = catalog.setupNotes ?? [];
  tpl = tpl.replace(
    /\{\{#SETUP_NOTES\}\}[\s\S]*?\{\{\/SETUP_NOTES\}\}/,
    setupNotes.map((n) => `- ${n}`).join("\n")
  );

  if (catalog.protocol === "rotorflight") {
    tpl = tpl.replace(/\{\{#ROTORFLIGHT_NOTE\}\}/, "");
    tpl = tpl.replace(/\{\{\/ROTORFLIGHT_NOTE\}\}/, "");
  } else {
    tpl = tpl.replace(/\{\{#ROTORFLIGHT_NOTE\}\}[\s\S]*?\{\{\/ROTORFLIGHT_NOTE\}\}/, "");
  }

  const sensorBlock =
    sensors.length > 0
      ? sensors.map((s) => `- **${s.name}** — ${s.description} (${s.unit})`).join("\n")
      : "- See generated widget source for sensor references";
  tpl = tpl.replace(/\{\{#SENSORS\}\}[\s\S]*?\{\{\/SENSORS\}\}/, sensorBlock);

  return tpl;
}

export async function packageWidget(
  widgetName: string,
  protocol: TelemetryProtocol,
  options?: { radioId?: string }
): Promise<{ zipPath: string; widgetDir: string; widgetName: string }> {
  const safeName = sanitizeWidgetName(widgetName);
  const repoRoot = getRepoRoot();
  const widgetDir = getGeneratedDir(safeName);
  const luaPath = getWidgetLuaPath(safeName);
  const radioId = options?.radioId ?? "tx15";

  const prepared = defaultWorkspace.prepareForRadio(safeName, radioId);
  if (!prepared.ok) {
    throw new Error(prepared.message);
  }

  assertValidForRelease(safeName, protocol, {
    radioId,
    strictTelemetry: true,
    ensureAnnotations: false,
  });

  const source = prepared.source;
  const installPath = join(widgetDir, "INSTALL.md");
  if (!existsSync(installPath)) {
    const radio = loadRadioProfile(radioId);
    const catalog = loadTelemetryCatalog(protocol);
    writeInstallMd(safeName, radio, catalog, source);
  }

  const distDir = join(repoRoot, "dist-output");
  mkdirSync(distDir, { recursive: true });

  const zipPath = join(distDir, `${safeName}.zip`);

  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve());
    archive.on("error", reject);

    archive.pipe(output);

    archive.file(luaPath, { name: `WIDGETS/${safeName}/main.lua` });

    if (existsSync(installPath)) {
      archive.file(installPath, { name: `WIDGETS/${safeName}/INSTALL.md` });
    }

    archive.finalize();
  });

  return { zipPath, widgetDir, widgetName: safeName };
}

export function writeInstallMd(
  widgetName: string,
  radio: RadioProfile,
  catalog: TelemetryCatalog,
  source: string
): string {
  const safeName = sanitizeWidgetName(widgetName);
  const sensorNames = catalog.sensors
    .filter((s) => source.includes(`"${s.name}"`))
    .map((s) => s.name);
  const content = renderInstallMd(safeName, radio, catalog, sensorNames);
  const dir = getGeneratedDir(safeName);
  mkdirSync(dir, { recursive: true });
  const installPath = join(dir, "INSTALL.md");
  writeFileSync(installPath, content, "utf-8");
  return installPath;
}
