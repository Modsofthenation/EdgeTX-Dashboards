import { readFileSync, existsSync } from "node:fs";
import type { SDKCustomTool } from "@cursor/sdk";
import type { TelemetryCategory, TelemetryProtocol } from "@widget-gen/shared";
import { loadTelemetryCatalog, loadRadioProfile } from "./knowledge.js";
import { validateWidgetForRelease } from "./validationPipeline.js";
import { getWidgetLuaPath, packageWidget, writeInstallMd } from "./package.js";
import { sanitizeWidgetName } from "./paths.js";
import type { LayoutArchetypeId } from "./layoutArchetype.js";
import { getActiveLayoutArchetype } from "./variationContext.js";

export function createCustomTools(): Record<string, SDKCustomTool> {
  return {
    validateWidget: {
      description:
        "Validate an EdgeTX Lua widget before download. Runs static checks, telemetry catalog validation, and archetype-scoped visual-design warnings (card panels for card-grid/heli, bands for strip/dense, DBLSIZE hero for hero-minimal). Must pass before packaging.",
      inputSchema: {
        type: "object",
        properties: {
          widgetName: { type: "string", description: "Widget folder name under generated/" },
          protocol: {
            type: "string",
            enum: ["betaflight", "rotorflight", "generic-crsf"],
            description: "Telemetry protocol for sensor validation",
          },
          radioId: { type: "string", description: "Radio profile id (default tx15)" },
          layoutArchetype: {
            type: "string",
            description:
              "Layout archetype id (card-grid, hero-minimal, strip-board, etc.) for visual-design rules",
          },
        },
        required: ["widgetName"],
      },
      execute(args) {
        try {
          const widgetName = sanitizeWidgetName(String(args.widgetName));
          const protocol = (args.protocol as TelemetryProtocol) ?? "generic-crsf";
          const radioId = String(args.radioId ?? "tx15");
          const layoutArchetype = (args.layoutArchetype as LayoutArchetypeId | undefined) ??
            getActiveLayoutArchetype();
          const path = getWidgetLuaPath(widgetName);
          if (!existsSync(path)) {
            return { content: [{ type: "text", text: `File not found for widget: ${widgetName}` }], isError: true };
          }
          const result = validateWidgetForRelease(widgetName, protocol, {
            radioId,
            strictTelemetry: true,
            layoutArchetype,
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
        "List validated telemetry sensor names for a protocol. Use only these names in getValue/getSourceIndex calls.",
      inputSchema: {
        type: "object",
        properties: {
          protocol: {
            type: "string",
            enum: ["betaflight", "rotorflight", "generic-crsf"],
          },
          category: {
            type: "string",
            enum: ["link", "battery", "gps", "attitude", "flight", "motor", "all"],
          },
        },
        required: ["protocol"],
      },
      execute(args) {
        const protocol = args.protocol as TelemetryProtocol;
        const category = (args.category as TelemetryCategory) ?? "all";
        const catalog = loadTelemetryCatalog(protocol);
        const sensors =
          category === "all"
            ? catalog.sensors
            : catalog.sensors.filter((s) => s.category === category);
        return JSON.stringify({ protocol: catalog.label, sensors, setupNotes: catalog.setupNotes }, null, 2);
      },
    },

    queryEdgeTxDocs: {
      description: "Query the EdgeTX Lua documentation via GitBook ask API.",
      inputSchema: {
        type: "object",
        properties: {
          question: { type: "string", description: "Specific question about EdgeTX Lua API" },
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
          return { content: [{ type: "text", text: `Docs query failed: ${res.status}` }], isError: true };
        }
        return await res.text();
      },
    },

    packageWidget: {
      description:
        "Package a generated dashboard into a zip for SD card deployment (WIDGETS/<name>/main.lua plus any SCRIPTS/TOOLS or SCRIPTS/TELEMETRY companions).",
      inputSchema: {
        type: "object",
        properties: {
          widgetName: { type: "string" },
          protocol: {
            type: "string",
            enum: ["betaflight", "rotorflight", "generic-crsf"],
          },
          radioId: { type: "string", description: "Radio profile id (default tx15)" },
        },
        required: ["widgetName", "protocol"],
      },
      async execute(args) {
        try {
          const widgetName = sanitizeWidgetName(String(args.widgetName));
          const protocol = args.protocol as TelemetryProtocol;
          const radioId = String(args.radioId ?? "tx15");
          const { widgetName: name } = await packageWidget(widgetName, protocol, { radioId });
          return JSON.stringify({ success: true, widgetName: name });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { content: [{ type: "text", text: msg }], isError: true };
        }
      },
    },

    writeInstallGuide: {
      description:
        "Generate INSTALL.md for a dashboard (and companion scripts if present) based on protocol and radio profile.",
      inputSchema: {
        type: "object",
        properties: {
          widgetName: { type: "string" },
          protocol: {
            type: "string",
            enum: ["betaflight", "rotorflight", "generic-crsf"],
          },
          radioId: { type: "string", default: "tx15" },
        },
        required: ["widgetName", "protocol"],
      },
      execute(args) {
        try {
          const widgetName = sanitizeWidgetName(String(args.widgetName));
          const protocol = args.protocol as TelemetryProtocol;
          const radioId = String(args.radioId ?? "tx15");
          const path = getWidgetLuaPath(widgetName);
          if (!existsSync(path)) {
            return { content: [{ type: "text", text: `File not found for widget: ${widgetName}` }], isError: true };
          }
          const source = readFileSync(path, "utf-8");
          const radio = loadRadioProfile(radioId);
          const catalog = loadTelemetryCatalog(protocol);
          writeInstallMd(widgetName, radio, catalog, source);
          return JSON.stringify({ success: true, widgetName });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { content: [{ type: "text", text: msg }], isError: true };
        }
      },
    },
  };
}
