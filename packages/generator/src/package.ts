import {
  createWriteStream,
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { ZipArchive } from "archiver";
import type {
  RadioProfile,
  TelemetryCatalog,
  TelemetryProtocol,
} from "@widget-gen/shared";
import {
  getRepoRoot,
  loadTelemetryCatalog,
  readTemplate,
  loadRadioProfile,
} from "./knowledge.ts";
import {
  detectCompanions,
  listWidgetPackageEntries,
} from "./packageEntries.ts";
import {
  getGeneratedDirForKey,
  getWidgetLuaPathForKey,
  sanitizeWidgetName,
  isWidgetInstanceId,
  sanitizeWidgetInstanceId,
} from "./paths.ts";
import { resolveDisplayName } from "./widgetInstance.ts";
import {
  readWidgetVersionSource,
  getWidgetVersionLuaPath,
} from "./widgetInstance.ts";
import { assertValidForRelease } from "./validationPipeline.ts";
import { defaultWorkspace } from "./workspace.ts";

export {
  getGeneratedDir,
  getWidgetLuaPath,
  sanitizeWidgetName,
} from "./paths.ts";

export function renderInstallMd(
  widgetName: string,
  radio: RadioProfile,
  catalog: TelemetryCatalog,
  sensorNames: string[],
  companions?: {
    tools: string[];
    telemetry: string[];
    assets?: string[];
    images?: string[];
  },
): string {
  let tpl = readTemplate("INSTALL.md.tpl");
  const sensors = catalog.sensors.filter((s) => sensorNames.includes(s.name));
  const tools = companions?.tools ?? [];
  const telemetry = companions?.telemetry ?? [];
  const images = companions?.images ?? [];

  tpl = tpl.replace(/\{\{WIDGET_NAME\}\}/g, widgetName);
  tpl = tpl.replace(/\{\{RADIO_NAME\}\}/g, radio.name);
  tpl = tpl.replace(/\{\{LCD_W\}\}/g, String(radio.lcdW));
  tpl = tpl.replace(/\{\{LCD_H\}\}/g, String(radio.lcdH));
  tpl = tpl.replace(/\{\{PROTOCOL_LABEL\}\}/g, catalog.label);

  const setupNotes = catalog.setupNotes ?? [];
  tpl = tpl.replace(
    /\{\{#SETUP_NOTES\}\}[\s\S]*?\{\{\/SETUP_NOTES\}\}/,
    setupNotes.map((n) => `- ${n}`).join("\n"),
  );

  if (catalog.protocol === "rotorflight") {
    tpl = tpl.replace(/\{\{#ROTORFLIGHT_NOTE\}\}/, "");
    tpl = tpl.replace(/\{\{\/ROTORFLIGHT_NOTE\}\}/, "");
  } else {
    tpl = tpl.replace(
      /\{\{#ROTORFLIGHT_NOTE\}\}[\s\S]*?\{\{\/ROTORFLIGHT_NOTE\}\}/,
      "",
    );
  }

  const sensorBlock =
    sensors.length > 0
      ? sensors
          .map((s) => `- **${s.name}** — ${s.description} (${s.unit})`)
          .join("\n")
      : "- See generated dashboard source for sensor references";
  tpl = tpl.replace(/\{\{#SENSORS\}\}[\s\S]*?\{\{\/SENSORS\}\}/, sensorBlock);

  const hasCompanions =
    tools.length > 0 || telemetry.length > 0 || images.length > 0;
  if (hasCompanions) {
    const companionBlock = [
      "## Companion scripts & assets",
      "",
      "This package includes helpers alongside the dashboard widget. Copy every path in the zip to the same location on the SD card.",
      "",
      tools.length > 0
        ? [
            "### Tool scripts (`SCRIPTS/TOOLS/`)",
            "",
            ...tools.map(
              (t) =>
                `1. Copy \`${t}\` to \`SD:/SCRIPTS/TOOLS/${t}\` on your radio.\n2. Open **SYS** → **Tools** → run **${t.replace(/\.lua$/, "")}**.`,
            ),
            "",
          ].join("\n")
        : "",
      telemetry.length > 0
        ? [
            "### Telemetry scripts (`SCRIPTS/TELEMETRY/`)",
            "",
            ...telemetry.map(
              (t) =>
                `1. Copy \`${t}\` to \`SD:/SCRIPTS/TELEMETRY/${t}\`.\n2. **Model** → **Telemetry** (or **Display**) → set a screen to **Script** → pick **${t.replace(/\.lua$/, "")}**.`,
            ),
            "",
          ].join("\n")
        : "",
      images.length > 0
        ? [
            "### Model images (`IMAGES/`)",
            "",
            ...images.map(
              (img) =>
                `1. Copy \`${img}\` to \`SD:/IMAGES/${img}\`.\n2. **Model Setup** → **Assign Bitmap** → select \`${img.replace(/\.png$/i, "")}\` (or match \`model.getInfo().bitmap\`).`,
            ),
            "",
          ].join("\n")
        : "",
      "Run companion setup **before** or **after** adding the dashboard widget, as described in the agent summary.",
    ].join("\n");
    tpl = tpl.replace(/\{\{#COMPANION_SCRIPTS\}\}/, "");
    tpl = tpl.replace(/\{\{\/COMPANION_SCRIPTS\}\}/, "");
    tpl = tpl.replace(/\{\{COMPANION_BLOCK\}\}/, companionBlock);
  } else {
    tpl = tpl.replace(
      /\{\{#COMPANION_SCRIPTS\}\}[\s\S]*?\{\{\/COMPANION_SCRIPTS\}\}/,
      "",
    );
    tpl = tpl.replace(/\{\{COMPANION_BLOCK\}\}/, "");
  }

  return tpl;
}

export async function packageWidget(
  workspaceKey: string,
  protocol: TelemetryProtocol,
  options?: { radioId?: string; version?: number; skipValidation?: boolean },
): Promise<{
  zipPath: string;
  widgetDir: string;
  widgetName: string;
  instanceId?: string;
}> {
  const radioId = options?.radioId ?? "tx15";
  const version = options?.version;
  const widgetDir = isWidgetInstanceId(workspaceKey)
    ? getGeneratedDirForKey(sanitizeWidgetInstanceId(workspaceKey))
    : getGeneratedDirForKey(sanitizeWidgetName(workspaceKey));
  const luaPath =
    version !== undefined && isWidgetInstanceId(workspaceKey)
      ? getWidgetVersionLuaPath(sanitizeWidgetInstanceId(workspaceKey), version)
      : getWidgetLuaPathForKey(workspaceKey);
  const repoRoot = getRepoRoot();

  let source: string;
  if (version !== undefined && isWidgetInstanceId(workspaceKey)) {
    const archived = readWidgetVersionSource(workspaceKey, version);
    if (!archived) {
      throw new Error(
        `Version ${version} not found for workspace ${workspaceKey}`,
      );
    }
    source = archived;
  } else {
    const prepared = defaultWorkspace.prepareForRadio(workspaceKey, radioId);
    if (!prepared.ok) {
      throw new Error(prepared.message);
    }
    source = prepared.source;

    if (!options?.skipValidation) {
      assertValidForRelease(workspaceKey, protocol, {
        radioId,
        strictTelemetry: true,
        ensureAnnotations: false,
      });
    }
  }

  const displayName = resolveDisplayName(workspaceKey);
  if (!displayName) {
    throw new Error(
      `Could not resolve radio display name for workspace ${workspaceKey}`,
    );
  }
  const safeDisplay = sanitizeWidgetName(displayName);

  const installPath = join(widgetDir, "INSTALL.md");
  if (!existsSync(installPath)) {
    const radio = loadRadioProfile(radioId);
    const catalog = loadTelemetryCatalog(protocol);
    writeInstallMd(workspaceKey, radio, catalog, source);
  }

  const distDir = join(repoRoot, "dist-output");
  mkdirSync(distDir, { recursive: true });

  const zipBaseName = isWidgetInstanceId(workspaceKey)
    ? sanitizeWidgetInstanceId(workspaceKey)
    : safeDisplay;
  const zipPath =
    version !== undefined
      ? join(distDir, `${zipBaseName}-v${version}.zip`)
      : join(distDir, `${zipBaseName}.zip`);

  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = new ZipArchive({ zlib: { level: 1 } });

    output.on("close", () => resolve());
    archive.on("error", reject);

    archive.pipe(output);

    if (version !== undefined) {
      archive.file(luaPath, { name: `WIDGETS/${safeDisplay}/main.lua` });
    } else {
      const entries = listWidgetPackageEntries(workspaceKey);
      if (entries.length === 0) {
        archive.file(luaPath, { name: `WIDGETS/${safeDisplay}/main.lua` });
      } else {
        for (const entry of entries) {
          archive.file(entry.filePath, { name: entry.zipPath });
        }
      }
    }

    archive.finalize();
  });

  return {
    zipPath,
    widgetDir,
    widgetName: safeDisplay,
    instanceId: isWidgetInstanceId(workspaceKey)
      ? sanitizeWidgetInstanceId(workspaceKey)
      : undefined,
  };
}

export function writeInstallMd(
  workspaceKey: string,
  radio: RadioProfile,
  catalog: TelemetryCatalog,
  source: string,
): string {
  const displayName = resolveDisplayName(workspaceKey) ?? workspaceKey;
  const safeDisplay = sanitizeWidgetName(displayName);
  const sensorNames = catalog.sensors
    .filter((s) => source.includes(`"${s.name}"`))
    .map((s) => s.name);
  const companions = detectCompanions(workspaceKey);
  const content = renderInstallMd(
    safeDisplay,
    radio,
    catalog,
    sensorNames,
    companions,
  );
  const dir = getGeneratedDirForKey(workspaceKey);
  mkdirSync(dir, { recursive: true });
  const installPath = join(dir, "INSTALL.md");
  writeFileSync(installPath, content, "utf-8");
  return installPath;
}
