import type { WidgetGenerator, RunCallbacks } from "@widget-gen/generator";
import type { GenerateSession, ValidationIssue } from "@widget-gen/shared";

export interface WidgetRunOutcome {
  runId: string;
  status: string;
  success: boolean;
  widgetName?: string;
  validated?: boolean;
  validationIssues?: ValidationIssue[];
}

export interface WidgetRunContext {
  session: GenerateSession;
  generator: WidgetGenerator;
  send: (data: object) => void;
}

/** Build SDK callbacks that mirror session state into SSE events. */
export function createRunCallbacks(ctx: WidgetRunContext): RunCallbacks {
  let lastWidgetName: string | undefined;

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
      if (name === lastWidgetName) return;
      lastWidgetName = name;
      ctx.session.widgetName = name;
      ctx.send({
        type: "widget",
        content: name,
        sessionId: ctx.session.id,
        widgetName: name,
      });
    },
  };
}

/** Persist run outcome on session and emit terminal SSE event. */
export function emitRunCompletion(
  ctx: WidgetRunContext,
  result: WidgetRunOutcome,
  options: { action: "generate" | "refine" }
): void {
  ctx.session.lastRunId = result.runId;
  if (result.widgetName) ctx.session.widgetName = result.widgetName;
  ctx.session.validated = result.validated ?? false;
  ctx.session.validationIssues = result.validationIssues ?? [];

  const actionLabel = options.action === "generate" ? "Generation" : "Refine";

  ctx.send({
    type: result.success ? "done" : "error",
    content: result.success
      ? `Validated and ready: ${result.widgetName}`
      : result.validated === false && result.widgetName
        ? `Widget ${result.widgetName} failed validation — download blocked`
        : `${actionLabel} failed (status: ${result.status})`,
    sessionId: ctx.session.id,
    widgetName: result.widgetName,
    success: result.success,
    validated: result.validated ?? false,
    validationIssues: result.validationIssues ?? [],
  });
}
