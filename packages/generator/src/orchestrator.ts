import type { SDKMessage, SDKToolUseMessage } from "@cursor/sdk";
import type { StreamEvent, TelemetryProtocol, ValidationIssue } from "@widget-gen/shared";
import { packageWidget } from "./package.js";
import { validateWidgetForRelease } from "./validationPipeline.js";

export interface RunCallbacks {
  onEvent?: (event: StreamEvent) => void;
  onWidgetName?: (name: string) => void;
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

function formatToolLabel(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

export function extractToolInfo(message: SDKMessage): string | null {
  if (message.type === "tool_call") {
    const call = message as SDKToolUseMessage;
    const label = formatToolLabel(call.name);
    if (call.status === "running") return label;
    if (call.status === "error") return `${label} (failed)`;
    return label;
  }

  if (message.type === "assistant") {
    const tools = message.message.content
      .filter((block) => block.type === "tool_use")
      .map((block) => formatToolLabel(block.name));
    if (tools.length > 0) return tools.join(", ");
  }

  if (message.type === "task") {
    return "Subagent task";
  }

  return null;
}

interface AgentRunLike {
  id: string;
  stream(): AsyncIterable<SDKMessage>;
  wait(): Promise<{ id: string; status: string; result?: string }>;
}

/** Stream SDK run events to callbacks; returns run metadata after stream completes. */
export async function streamAgentRun(
  run: AgentRunLike,
  agentId: string,
  callbacks: RunCallbacks | undefined,
  resolveName: () => string | undefined
): Promise<{ runId: string; status: string; result?: string; widgetName?: string }> {
  let lastReportedName: string | undefined;

  for await (const event of run.stream()) {
    const text = extractTextFromMessage(event);
    if (text) {
      callbacks?.onEvent?.({ type: "text", content: text, runId: run.id, agentId });
    }
    const tool = extractToolInfo(event);
    if (tool) {
      callbacks?.onEvent?.({ type: "tool", content: tool, runId: run.id, agentId });
    }
    const name = resolveName();
    if (name && name !== lastReportedName) {
      lastReportedName = name;
      callbacks?.onWidgetName?.(name);
    }
  }

  const result = await run.wait();
  const widgetName = resolveName();
  return {
    runId: result.id,
    status: result.status,
    result: result.result,
    widgetName,
  };
}

/** Validate and package a widget after a successful agent run. */
export async function finalizeWidgetRun(
  widgetName: string,
  protocol: TelemetryProtocol,
  radioId: string,
  callbacks?: RunCallbacks
): Promise<{ validated: boolean; validationIssues: ValidationIssue[] }> {
  const validation = validateWidgetForRelease(widgetName, protocol, {
    radioId,
    strictTelemetry: true,
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

  try {
    await packageWidget(widgetName, protocol, { radioId });
    callbacks?.onEvent?.({
      type: "status",
      content: "Validation passed. Widget packaged for download.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    callbacks?.onEvent?.({ type: "error", content: `Packaging failed: ${msg}` });
    return { validated: false, validationIssues: validation.issues };
  }

  return { validated: true, validationIssues: validation.issues };
}
