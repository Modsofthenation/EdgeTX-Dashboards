import type {
  WidgetGenerator,
  RunCallbacks,
  WidgetWorkspaceInfo,
} from "@widget-gen/generator";
import type { GenerateSession, ValidationIssue } from "@widget-gen/shared";

export interface WidgetRunOutcome {
  runId: string;
  status: string;
  success: boolean;
  result?: string;
  widgetName?: string;
  widgetInstanceId?: string;
  widgetVersion?: number;
  validated?: boolean;
  validationIssues?: ValidationIssue[];
}

export interface WidgetRunContext {
  session: GenerateSession;
  generator: WidgetGenerator;
  send: (data: object) => void;
}

function emitWidgetWorkspace(
  ctx: WidgetRunContext,
  info: WidgetWorkspaceInfo,
): void {
  ctx.session.widgetInstanceId = info.instanceId;
  ctx.session.widgetName = info.displayName;
  ctx.session.widgetVersion = info.version;
  ctx.send({
    type: "widget",
    content: info.displayName,
    sessionId: ctx.session.id,
    widgetName: info.displayName,
    widgetInstanceId: info.instanceId,
    widgetVersion: info.version,
  });
}

/** Build SDK callbacks that mirror session state into SSE events. */
export function createRunCallbacks(ctx: WidgetRunContext): RunCallbacks {
  let lastWorkspaceKey: string | undefined;

  return {
    onEvent: (ev) => {
      ctx.send({
        type: ev.type,
        content: ev.content,
        detail: ev.detail,
        todos: ev.todos,
        toolName: ev.toolName,
        sessionId: ctx.session.id,
      });
    },
    onWidgetName: (name) => {
      if (name === lastWorkspaceKey) return;
      lastWorkspaceKey = name;
      // Legacy name-only folders — UUID workspaces use onWidgetWorkspace instead.
      if (/^[0-9a-f-]{36}$/i.test(name)) return;
      ctx.session.widgetName = name;
      ctx.send({
        type: "widget",
        content: name,
        sessionId: ctx.session.id,
        widgetName: name,
      });
    },
    onWidgetWorkspace: (info) => {
      if (info.instanceId === lastWorkspaceKey) return;
      lastWorkspaceKey = info.instanceId;
      emitWidgetWorkspace(ctx, info);
    },
  };
}

/** Persist run outcome on session and emit terminal SSE event. */
export function emitRunCompletion(
  ctx: WidgetRunContext,
  result: WidgetRunOutcome,
  options: { action: "generate" | "refine" },
): void {
  ctx.session.lastRunId = result.runId;
  if (result.widgetName) ctx.session.widgetName = result.widgetName;
  if (result.widgetInstanceId)
    ctx.session.widgetInstanceId = result.widgetInstanceId;
  if (result.widgetVersion !== undefined)
    ctx.session.widgetVersion = result.widgetVersion;
  ctx.session.validated = result.validated ?? false;
  ctx.session.validationIssues = result.validationIssues ?? [];

  const actionLabel = options.action === "generate" ? "Generation" : "Refine";
  const label = result.widgetName
    ? `${result.widgetName}${result.widgetVersion !== undefined ? ` v${result.widgetVersion}` : ""}`
    : undefined;
  const cancelled = result.status === "cancelled";
  const detail =
    typeof result.result === "string" && result.result.trim()
      ? result.result.trim().replace(/\s+/g, " ").slice(0, 280)
      : "";

  const failureContent =
    result.validated === false && result.widgetName
      ? `Widget ${label} failed validation — download blocked`
      : detail
        ? `${actionLabel} failed (status: ${result.status}): ${detail}`
        : `${actionLabel} failed (status: ${result.status})`;

  ctx.send({
    type: result.success ? "done" : cancelled ? "status" : "error",
    content: result.success
      ? `Validated and ready: ${label}`
      : cancelled
        ? `${actionLabel} cancelled`
        : failureContent,
    sessionId: ctx.session.id,
    widgetName: result.widgetName,
    widgetInstanceId: result.widgetInstanceId,
    widgetVersion: result.widgetVersion,
    success: result.success,
    validated: result.validated ?? false,
    validationIssues: result.validationIssues ?? [],
  });
}
