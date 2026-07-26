import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, relative, resolve } from "node:path";
import type { SDKCustomTool } from "@cursor/sdk";
import {
  createCustomTools,
  type ToolSessionDefaults,
} from "../agentTools.ts";
import { getRepoRoot } from "../knowledge.ts";
import {
  getWidgetLuaPathForKey,
  isWidgetInstanceId,
  sanitizeWidgetInstanceId,
  sanitizeWidgetName,
} from "../paths.ts";

export interface HttpToolDefinition {
  name: string;
  description: string;
  /** JSON Schema object for tool parameters. */
  parameters: Record<string, unknown>;
  execute: (
    args: Record<string, unknown>,
  ) => Promise<{ text: string; isError?: boolean }>;
}

function normalizeToolResult(raw: unknown): {
  text: string;
  isError?: boolean;
} {
  if (typeof raw === "string") return { text: raw };
  if (raw && typeof raw === "object") {
    const obj = raw as {
      isError?: boolean;
      content?: Array<{ type?: string; text?: string }>;
    };
    if (Array.isArray(obj.content)) {
      const text = obj.content
        .map((c) => (typeof c?.text === "string" ? c.text : ""))
        .filter(Boolean)
        .join("\n");
      return { text: text || JSON.stringify(raw), isError: obj.isError };
    }
    return { text: JSON.stringify(raw), isError: obj.isError };
  }
  return { text: String(raw) };
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
  throw new Error("widgetInstanceId is required");
}

function assertUnderGenerated(relPath: string, workspaceKey: string): string {
  const repoRoot = getRepoRoot();
  const base = resolve(repoRoot, "generated", workspaceKey);
  const cleaned = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (
    cleaned.includes("..") ||
    cleaned.startsWith("/") ||
    cleaned.includes("\0")
  ) {
    throw new Error(`Unsafe relative path: ${relPath}`);
  }
  const dest = resolve(base, cleaned);
  const rel = relative(base, dest);
  if (rel.startsWith("..") || normalize(rel) !== rel) {
    throw new Error(`Path escapes workspace: ${relPath}`);
  }
  return dest;
}

function sdkToolsToHttp(
  sdkTools: Record<string, SDKCustomTool>,
): HttpToolDefinition[] {
  return Object.entries(sdkTools).map(([name, tool]) => ({
    name,
    description: tool.description ?? name,
    parameters: (tool.inputSchema ?? {
      type: "object",
      properties: {},
    }) as Record<string, unknown>,
    async execute(args) {
      const raw = await Promise.resolve(
        tool.execute(args as Record<string, import("@cursor/sdk").SDKJsonValue>, {}),
      );
      return normalizeToolResult(raw);
    },
  }));
}

/**
 * Tools for Anthropic/OpenAI agents: existing Cursor custom tools plus explicit
 * workspace file read/write (Cursor agents use built-in FS tools instead).
 */
export function createHttpTools(
  defaults?: ToolSessionDefaults,
): HttpToolDefinition[] {
  const sdk = createCustomTools(defaults);
  const http = sdkToolsToHttp(sdk);

  http.push(
    {
      name: "writeWidgetFile",
      description:
        "Write a text file under generated/<widgetInstanceId>/. Use relativePath like main.lua or tools/foo.lua. Required for creating/updating the dashboard — there is no generic filesystem Write tool.",
      parameters: {
        type: "object",
        properties: {
          widgetInstanceId: {
            type: "string",
            description: "UUID workspace folder",
          },
          relativePath: {
            type: "string",
            description: "Path relative to the workspace folder (e.g. main.lua)",
          },
          contents: {
            type: "string",
            description: "Full file contents to write",
          },
        },
        required: ["widgetInstanceId", "relativePath", "contents"],
      },
      async execute(args) {
        try {
          const workspaceKey = resolveWorkspaceKey(args, defaults);
          if (
            defaults?.widgetInstanceId &&
            workspaceKey !== sanitizeWidgetInstanceId(defaults.widgetInstanceId)
          ) {
            return {
              text: `Wrong workspace id "${workspaceKey}". Use "${defaults.widgetInstanceId}".`,
              isError: true,
            };
          }
          const relativePath = String(args.relativePath ?? "main.lua");
          const contents = String(args.contents ?? "");
          const dest = assertUnderGenerated(relativePath, workspaceKey);
          mkdirSync(dirname(dest), { recursive: true });
          writeFileSync(dest, contents, "utf-8");
          return {
            text: JSON.stringify({
              success: true,
              path: `generated/${workspaceKey}/${relativePath.replace(/^\/+/, "")}`,
              bytes: Buffer.byteLength(contents, "utf-8"),
            }),
          };
        } catch (err) {
          return {
            text: err instanceof Error ? err.message : String(err),
            isError: true,
          };
        }
      },
    },
    {
      name: "readWidgetFile",
      description:
        "Read a text file under generated/<widgetInstanceId>/. Defaults to main.lua.",
      parameters: {
        type: "object",
        properties: {
          widgetInstanceId: { type: "string" },
          relativePath: {
            type: "string",
            description: "Defaults to main.lua",
          },
        },
        required: ["widgetInstanceId"],
      },
      async execute(args) {
        try {
          const workspaceKey = resolveWorkspaceKey(args, defaults);
          const relativePath = String(args.relativePath ?? "main.lua");
          const dest =
            relativePath === "main.lua"
              ? getWidgetLuaPathForKey(workspaceKey)
              : assertUnderGenerated(relativePath, workspaceKey);
          if (!existsSync(dest)) {
            return { text: `File not found: ${relativePath}`, isError: true };
          }
          return { text: readFileSync(dest, "utf-8") };
        } catch (err) {
          return {
            text: err instanceof Error ? err.message : String(err),
            isError: true,
          };
        }
      },
    },
  );

  return http;
}

export function httpToolsSystemAddendum(): string {
  return `
## Provider file tools (required)
You do **not** have a generic filesystem Write/Read tool.
- Use \`writeWidgetFile\` with widgetInstanceId + relativePath (\`main.lua\`, \`tools/…\`, \`telemetry/…\`) + contents.
- Use \`readWidgetFile\` to inspect existing files before refining.
- Still call \`validateWidget\` with widgetInstanceId until \`valid: true\`.
- Do **not** call writeInstallGuide or packageWidget — the server packages after validation.
`.trim();
}

/** Resolve path join helper for tests. */
export function joinGenerated(workspaceKey: string, rel: string): string {
  return join(getRepoRoot(), "generated", workspaceKey, rel);
}
