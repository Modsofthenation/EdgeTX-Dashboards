import type { SDKMessage, SDKToolUseMessage } from "@cursor/sdk";
import type {
  StreamEvent,
  TelemetryProtocol,
  ValidationIssue,
} from "@widget-gen/shared";
import { packageWidget } from "./package.ts";
import { describeToolUse } from "./toolDisplay.ts";
import { validateWidgetForRelease } from "./validationPipeline.ts";
import { isWidgetInstanceId } from "./paths.ts";
import {
  archiveWidgetVersion,
  readWidgetInstanceMeta,
} from "./widgetInstance.ts";

export interface WidgetWorkspaceInfo {
  instanceId: string;
  displayName: string;
  version: number;
}

export interface RunCallbacks {
  onEvent?: (event: StreamEvent) => void;
  onWidgetName?: (name: string) => void;
  onWidgetWorkspace?: (info: WidgetWorkspaceInfo) => void;
}

export function extractTextFromMessage(message: SDKMessage): string | null {
  if (message.type !== "assistant") return null;
  const parts: string[] = [];
  for (const block of message.message.content) {
    if (block.type === "text") {
      parts.push(block.text);
    }
  }
  return parts.length > 0 ? parts.join("") : null;
}

type ToolStreamEvent = {
  type: "tool" | "todo";
  content: string;
  detail?: string;
  todos?: StreamEvent["todos"];
  toolName?: string;
};

function buildToolStreamEvents(
  name: string,
  input: unknown,
  status?: SDKToolUseMessage["status"],
): ToolStreamEvent[] {
  const info = describeToolUse(name, input);

  if (info.todos && info.todos.length > 0) {
    return [
      { type: "todo", content: info.label, todos: info.todos, toolName: name },
    ];
  }

  let label = info.label;
  if (status === "error") label = `${label} (failed)`;

  return [
    { type: "tool", content: label, detail: info.detail, toolName: name },
  ];
}

/** @deprecated Use extractToolEventsFromMessage — kept for tests and CLI parity. */
export function extractToolInfo(message: SDKMessage): string | null {
  const events = extractToolEventsFromMessage(message);
  if (events.length === 0) return null;
  return events
    .map((event) => {
      if (event.type === "todo") return event.content;
      return event.detail ? `${event.content}: ${event.detail}` : event.content;
    })
    .join(", ");
}

export function extractToolEventsFromMessage(
  message: SDKMessage,
): ToolStreamEvent[] {
  if (message.type === "tool_call") {
    const call = message as SDKToolUseMessage;
    return buildToolStreamEvents(call.name, call.args, call.status);
  }

  if (message.type === "assistant") {
    const events: ToolStreamEvent[] = [];
    for (const block of message.message.content) {
      if (block.type === "tool_use") {
        events.push(...buildToolStreamEvents(block.name, block.input));
      }
    }
    return events;
  }

  if (message.type === "task") {
    const detail = message.text?.trim();
    return [
      { type: "tool", content: "Subagent task", detail: detail || undefined },
    ];
  }

  return [];
}

interface AgentRunLike {
  id: string;
  stream(): AsyncIterable<SDKMessage>;
  wait(): Promise<{ id: string; status: string; result?: string }>;
  cancel?: () => Promise<void>;
  supports?: (capability: never) => boolean;
}

/** Stream SDK run events to callbacks; returns run metadata after stream completes. */
export async function streamAgentRun(
  run: AgentRunLike,
  agentId: string,
  callbacks: RunCallbacks | undefined,
  resolveName: () => string | undefined,
  signal?: AbortSignal,
): Promise<{
  runId: string;
  status: string;
  result?: string;
  widgetName?: string;
}> {
  let lastReportedName: string | undefined;

  const cancelRun = async () => {
    try {
      if (typeof run.cancel === "function") {
        const canCancel =
          typeof run.supports !== "function" ||
          // Cursor SDK types `supports("cancel")` narrowly; call via cast.
          (run.supports as (op: string) => boolean)("cancel");
        if (canCancel) {
          await run.cancel();
        }
      }
    } catch {
      // Best-effort cancel
    }
  };

  if (signal?.aborted) {
    await cancelRun();
    return {
      runId: run.id,
      status: "cancelled",
      widgetName: resolveName(),
    };
  }

  const onAbort = () => {
    void cancelRun();
  };
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    for await (const event of run.stream()) {
      if (signal?.aborted) {
        await cancelRun();
        return {
          runId: run.id,
          status: "cancelled",
          widgetName: resolveName(),
        };
      }

      const text = extractTextFromMessage(event);
      if (text) {
        callbacks?.onEvent?.({
          type: "text",
          content: text,
          runId: run.id,
          agentId,
        });
      }

      for (const toolEvent of extractToolEventsFromMessage(event)) {
        callbacks?.onEvent?.({ ...toolEvent, runId: run.id, agentId });
      }

      const name = resolveName();
      if (name && name !== lastReportedName) {
        lastReportedName = name;
        callbacks?.onWidgetName?.(name);
      }
    }

    if (signal?.aborted) {
      await cancelRun();
      return {
        runId: run.id,
        status: "cancelled",
        widgetName: resolveName(),
      };
    }

    const result = await run.wait();
    const widgetName = resolveName();
    return {
      runId: result.id,
      status: signal?.aborted ? "cancelled" : result.status,
      result: result.result,
      widgetName,
    };
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}

/** Validate and package a widget after a successful agent run. */
export async function finalizeWidgetRun(
  workspaceKey: string,
  protocol: TelemetryProtocol,
  radioId: string,
  callbacks?: RunCallbacks,
  options?: {
    layoutArchetype?: import("./layoutArchetype.ts").LayoutArchetypeId;
    userPrompt?: string;
  },
): Promise<{ validated: boolean; validationIssues: ValidationIssue[] }> {
  const validation = validateWidgetForRelease(workspaceKey, protocol, {
    radioId,
    strictTelemetry: true,
    layoutArchetype: options?.layoutArchetype,
    userPrompt: options?.userPrompt,
    strictIntent: true,
  });

  if (!validation.valid) {
    const summary = validation.issues
      .filter((i) => i.severity === "error")
      .map((i) => i.message)
      .join("; ");
    callbacks?.onEvent?.({
      type: "error",
      content: `Validation failed — download blocked: ${summary}`,
    });
    return { validated: false, validationIssues: validation.issues };
  }

  if (validation.autoFixes?.length) {
    callbacks?.onEvent?.({
      type: "status",
      content: `Auto-fixed Lua: ${validation.autoFixes.join("; ")}`,
    });
  }

  try {
    // Validation already ran above — skip the duplicate assert inside packageWidget.
    await packageWidget(workspaceKey, protocol, {
      radioId,
      skipValidation: true,
    });
    if (isWidgetInstanceId(workspaceKey)) {
      const meta = readWidgetInstanceMeta(workspaceKey);
      if (meta) archiveWidgetVersion(workspaceKey, meta.version);
    }
    callbacks?.onEvent?.({
      type: "status",
      content: "Validation passed. Widget packaged for download.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    callbacks?.onEvent?.({
      type: "error",
      content: `Packaging failed: ${msg}`,
    });
    return { validated: false, validationIssues: validation.issues };
  }

  return { validated: true, validationIssues: validation.issues };
}
