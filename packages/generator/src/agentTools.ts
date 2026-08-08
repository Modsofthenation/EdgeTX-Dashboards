import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { SDKCustomTool } from "@cursor/sdk";
import {
  createPrefabShellSource,
  insertPrefabSections,
  listPrefabCatalog,
} from "@widget-gen/editor-core";
import type { TelemetryCategory, TelemetryProtocol } from "@widget-gen/shared";
import { loadTelemetryCatalog, loadRadioProfile } from "./knowledge.ts";
import { validateWidgetForRelease } from "./validationPipeline.ts";
import { packageWidget, writeInstallMd } from "./package.ts";
import {
  getWidgetLuaPathForKey,
  sanitizeWidgetName,
  sanitizeWidgetInstanceId,
  isWidgetInstanceId,
} from "./paths.ts";
import { resolveDisplayName } from "./widgetInstance.ts";
import type { LayoutArchetypeId } from "./layoutArchetype.ts";
import { getActiveLayoutArchetype } from "./variationContext.ts";

export interface ToolSessionDefaults {
  protocol?: TelemetryProtocol;
  radioId?: string;
  /** UUID workspace folder for this chat widget. */
  widgetInstanceId?: string;
  /** EdgeTX radio display name (≤10 chars). */
  widgetName?: string;
  widgetVersion?: number;
  /** Active layout archetype for this session (avoids process-global races). */
  layoutArchetype?: LayoutArchetypeId;
  /** Original user prompt for intent coverage checks. */
  userPrompt?: string;
}

function resolveToolProtocol(
  args: Record<string, unknown>,
  defaults?: ToolSessionDefaults,
): TelemetryProtocol {
  // Session protocol is authoritative — agents must not validate against a
  // different catalog than the request that started the run.
  if (defaults?.protocol) return defaults.protocol;
  if (args.protocol) return args.protocol as TelemetryProtocol;
  return "generic-crsf";
}

function resolveWorkspaceKey(
  args: Record<string, unknown>,
  defaults?: ToolSessionDefaults,
): string {
  const fromArgs = args.widgetInstanceId ?? args.widgetName;
  if (fromArgs) {
    const raw = String(fromArgs);
    return isWidgetInstanceId(raw)
      ? sanitizeWidgetInstanceId(raw)
      : sanitizeWidgetName(raw);
  }
  if (defaults?.widgetInstanceId) {
    return sanitizeWidgetInstanceId(defaults.widgetInstanceId);
  }
  if (defaults?.widgetName) {
    return sanitizeWidgetName(defaults.widgetName);
  }
  throw new Error("widgetInstanceId is required for this session");
}

export function createCustomTools(
  defaults?: ToolSessionDefaults,
): Record<string, SDKCustomTool> {
  const workspaceKeyProp = {
    widgetInstanceId: {
      type: "string",
      description:
        "UUID workspace folder under generated/ (use the session-assigned id)",
    },
    widgetName: {
      type: "string",
      description: "Legacy display-name folder — prefer widgetInstanceId",
    },
  };

  return {
    validateWidget: {
      description:
        "Validate an EdgeTX Lua widget before download. Runs static checks, telemetry catalog validation, runtime API checks (lcd.drawLine pattern arg, Bitmap.getSize handle — same failures as radio/WASM create), stub-aware lcd.* calls, and archetype-scoped visual-design warnings. Must pass before packaging.",
      inputSchema: {
        type: "object",
        properties: {
          ...workspaceKeyProp,
          protocol: {
            type: "string",
            enum: ["betaflight", "rotorflight", "generic-crsf"],
            description: "Telemetry protocol for sensor validation",
          },
          radioId: {
            type: "string",
            description: "Radio profile id (default tx15)",
          },
          layoutArchetype: {
            type: "string",
            description:
              "Layout archetype id (card-grid, hero-minimal, strip-board, etc.) for visual-design rules",
          },
        },
        required: ["widgetInstanceId"],
      },
      execute(args) {
        try {
          const workspaceKey = resolveWorkspaceKey(args, defaults);
          if (
            defaults?.widgetInstanceId &&
            workspaceKey !== sanitizeWidgetInstanceId(defaults.widgetInstanceId)
          ) {
            return {
              content: [
                {
                  type: "text",
                  text: `Wrong workspace id "${workspaceKey}". Use the assigned id "${defaults.widgetInstanceId}" for this session.`,
                },
              ],
              isError: true,
            };
          }
          const protocol = resolveToolProtocol(args, defaults);
          const radioId = String(defaults?.radioId ?? args.radioId ?? "tx15");
          const layoutArchetype =
            defaults?.layoutArchetype ??
            (args.layoutArchetype as LayoutArchetypeId | undefined) ??
            getActiveLayoutArchetype();
          const path = getWidgetLuaPathForKey(workspaceKey);
          if (!existsSync(path)) {
            return {
              content: [
                {
                  type: "text",
                  text: `File not found for workspace: ${workspaceKey}`,
                },
              ],
              isError: true,
            };
          }
          if (defaults?.widgetName) {
            const displayName = resolveDisplayName(workspaceKey);
            if (displayName && displayName !== defaults.widgetName) {
              return {
                content: [
                  {
                    type: "text",
                    text: `Lua display name "${displayName}" does not match assigned name "${defaults.widgetName}". Set local name = "${defaults.widgetName}".`,
                  },
                ],
                isError: true,
              };
            }
          }
          const result = validateWidgetForRelease(workspaceKey, protocol, {
            radioId,
            strictTelemetry: true,
            layoutArchetype,
            userPrompt: defaults?.userPrompt,
            strictIntent: true,
          });
          return JSON.stringify(result, null, 2);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { content: [{ type: "text", text: msg }], isError: true };
        }
      },
    },

    listTelemetrySensors: {
      description:
        "Optional: list telemetry sensors filtered by category. Prefer the sensor catalog already inlined in the generation prompt.",
      inputSchema: {
        type: "object",
        properties: {
          protocol: {
            type: "string",
            enum: ["betaflight", "rotorflight", "generic-crsf"],
          },
          category: {
            type: "string",
            enum: [
              "link",
              "battery",
              "gps",
              "attitude",
              "flight",
              "motor",
              "all",
            ],
          },
        },
        required: ["protocol"],
      },
      execute(args) {
        const protocol = resolveToolProtocol(args, defaults);
        const category = (args.category as TelemetryCategory) ?? "all";
        const catalog = loadTelemetryCatalog(protocol);
        const sensors =
          category === "all"
            ? catalog.sensors
            : catalog.sensors.filter((s) => s.category === category);
        // Compact payload — names + units only (prompt already has the full list).
        return JSON.stringify({
          protocol: catalog.protocol,
          sensors: sensors.map((s) => ({
            name: s.name,
            unit: s.unit,
            category: s.category,
          })),
        });
      },
    },

    listPrefabSections: {
      description:
        "List modular dashboard prefab section ids (RF heli / Betaflight-CRSF quad) for composeWidgetFromPrefabs. Prefer the catalog already inlined in the prompt.",
      inputSchema: {
        type: "object",
        properties: {
          protocol: {
            type: "string",
            enum: ["betaflight", "rotorflight", "generic-crsf"],
          },
        },
        required: [],
      },
      execute(args) {
        const protocol = resolveToolProtocol(args, defaults);
        return JSON.stringify({
          protocol,
          sections: listPrefabCatalog({ protocol }),
        });
      },
    },

    composeWidgetFromPrefabs: {
      description:
        "Assemble main.lua from prefab section ids (same blocks as Layout Insert). Prefer canonical board recipes from the prompt. Writes generated/<widgetInstanceId>/main.lua with -- prefab:<id> markers.",
      inputSchema: {
        type: "object",
        properties: {
          ...workspaceKeyProp,
          prefabIds: {
            type: "array",
            items: { type: "string" },
            description:
              "Ordered prefab section ids (e.g. whoop or RF electric board recipe)",
          },
          displayName: {
            type: "string",
            description: "EdgeTX widget display name (≤10 chars)",
          },
          replace: {
            type: "boolean",
            description:
              "When true (default), rebuild from an empty shell. When false, append into existing main.lua.",
          },
          lcdW: {
            type: "number",
            description: "Target LCD width (default from radio profile)",
          },
          lcdH: {
            type: "number",
            description: "Target LCD height (default from radio profile)",
          },
        },
        required: ["widgetInstanceId", "prefabIds"],
      },
      execute(args) {
        try {
          const workspaceKey = resolveWorkspaceKey(args, defaults);
          if (
            defaults?.widgetInstanceId &&
            workspaceKey !== sanitizeWidgetInstanceId(defaults.widgetInstanceId)
          ) {
            return {
              content: [
                {
                  type: "text",
                  text: `Wrong workspace id "${workspaceKey}". Use the assigned id "${defaults.widgetInstanceId}" for this session.`,
                },
              ],
              isError: true,
            };
          }
          const prefabIds = Array.isArray(args.prefabIds)
            ? args.prefabIds.map(String)
            : [];
          if (prefabIds.length === 0) {
            return {
              content: [
                { type: "text", text: "prefabIds must be a non-empty array" },
              ],
              isError: true,
            };
          }
          const radioId = String(defaults?.radioId ?? args.radioId ?? "tx15");
          const radio = loadRadioProfile(radioId);
          const lcdW =
            typeof args.lcdW === "number" ? args.lcdW : (radio.lcdW ?? 480);
          const lcdH =
            typeof args.lcdH === "number" ? args.lcdH : (radio.lcdH ?? 320);
          const displayName = sanitizeWidgetName(
            String(
              args.displayName ??
                defaults?.widgetName ??
                resolveDisplayName(workspaceKey) ??
                "Dash",
            ).slice(0, 10),
          );
          const path = getWidgetLuaPathForKey(workspaceKey);
          const replace = args.replace !== false;
          let base =
            !replace && existsSync(path)
              ? readFileSync(path, "utf-8")
              : createPrefabShellSource(displayName);
          if (replace || !existsSync(path)) {
            base = createPrefabShellSource(displayName);
          }
          const { source, inserted } = insertPrefabSections(base, prefabIds, {
            lcdW,
            lcdH,
          });
          if (inserted.length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: `No known prefab ids in: ${prefabIds.join(", ")}`,
                },
              ],
              isError: true,
            };
          }
          mkdirSync(dirname(path), { recursive: true });
          writeFileSync(path, source, "utf-8");
          return JSON.stringify({
            success: true,
            widgetInstanceId: workspaceKey,
            displayName,
            inserted,
            skipped: prefabIds.filter((id) => !inserted.includes(id)),
            lcdW,
            lcdH,
            path: `generated/${workspaceKey}/main.lua`,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { content: [{ type: "text", text: msg }], isError: true };
        }
      },
    },

    queryEdgeTxDocs: {
      description:
        "Query EdgeTX Lua docs only when a specific API signature is unclear. Prefer runtime-api-pitfalls already in the prompt — avoid this tool on the happy path.",
      inputSchema: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "Specific question about EdgeTX Lua API",
          },
          goal: { type: "string", description: "Broader goal context" },
        },
        required: ["question"],
      },
      async execute(args) {
        const question = encodeURIComponent(String(args.question));
        const goal = args.goal ? encodeURIComponent(String(args.goal)) : "";
        const url = goal
          ? `https://luadoc.edgetx.org/readme.md?ask=${question}&goal=${goal}`
          : `https://luadoc.edgetx.org/readme.md?ask=${question}`;
        const res = await fetch(url);
        if (!res.ok) {
          return {
            content: [
              { type: "text", text: `Docs query failed: ${res.status}` },
            ],
            isError: true,
          };
        }
        return await res.text();
      },
    },

    packageWidget: {
      description:
        "Optional: package a validated dashboard into a zip. Prefer letting the server package after validateWidget succeeds — only call this if you need an immediate zip mid-session.",
      inputSchema: {
        type: "object",
        properties: {
          ...workspaceKeyProp,
          protocol: {
            type: "string",
            enum: ["betaflight", "rotorflight", "generic-crsf"],
          },
          radioId: {
            type: "string",
            description: "Radio profile id (default tx15)",
          },
        },
        required: ["widgetInstanceId", "protocol"],
      },
      async execute(args) {
        try {
          const workspaceKey = resolveWorkspaceKey(args, defaults);
          const protocol = args.protocol as TelemetryProtocol;
          const radioId = String(args.radioId ?? "tx15");
          const { widgetName: name, instanceId } = await packageWidget(
            workspaceKey,
            protocol,
            { radioId },
          );
          return JSON.stringify({
            success: true,
            widgetName: name,
            widgetInstanceId: instanceId ?? workspaceKey,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { content: [{ type: "text", text: msg }], isError: true };
        }
      },
    },

    writeInstallGuide: {
      description:
        "Optional: write INSTALL.md. Prefer letting the server generate the install guide during packaging after validateWidget succeeds.",
      inputSchema: {
        type: "object",
        properties: {
          ...workspaceKeyProp,
          protocol: {
            type: "string",
            enum: ["betaflight", "rotorflight", "generic-crsf"],
          },
          radioId: { type: "string", default: "tx15" },
        },
        required: ["widgetInstanceId", "protocol"],
      },
      execute(args) {
        try {
          const workspaceKey = resolveWorkspaceKey(args, defaults);
          const protocol = args.protocol as TelemetryProtocol;
          const radioId = String(args.radioId ?? "tx15");
          const path = getWidgetLuaPathForKey(workspaceKey);
          if (!existsSync(path)) {
            return {
              content: [
                {
                  type: "text",
                  text: `File not found for workspace: ${workspaceKey}`,
                },
              ],
              isError: true,
            };
          }
          const source = readFileSync(path, "utf-8");
          const radio = loadRadioProfile(radioId);
          const catalog = loadTelemetryCatalog(protocol);
          writeInstallMd(workspaceKey, radio, catalog, source);
          const displayName = resolveDisplayName(workspaceKey) ?? workspaceKey;
          return JSON.stringify({
            success: true,
            widgetName: displayName,
            widgetInstanceId: workspaceKey,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { content: [{ type: "text", text: msg }], isError: true };
        }
      },
    },
  };
}
