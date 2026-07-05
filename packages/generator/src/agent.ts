import { Agent, CursorAgentError, type SDKAgent } from "@cursor/sdk";
import type { GenerateRequest, GenerateSession, TelemetryProtocol, ValidationIssue } from "@widget-gen/shared";
import { buildGenerationPrompt, buildRefinePrompt, getArchetypeForSession } from "./promptComposer.js";
import { shouldBumpRunIndexForRefine, deriveVariationSeed } from "./designVariation.js";
import { allocateWidgetName } from "./widgetNaming.js";
import { createCustomTools } from "./agentTools.js";
import { getRepoRoot, loadRadioProfile, loadTelemetryCatalog } from "./knowledge.js";
import { findLatestWidgetName } from "./widgetResolve.js";
import { existsSync } from "node:fs";
import { getWidgetLuaPath } from "./paths.js";
import { resolveLocalAgentStore } from "./localAgentStore.js";
import {
  finalizeWidgetRun,
  streamAgentRun,
  type RunCallbacks,
} from "./orchestrator.js";
import type { ToolSessionDefaults } from "./agentTools.js";

export type { RunCallbacks };

export class WidgetGenerator {
  private agent: SDKAgent | null = null;
  private readonly repoRoot: string;
  private readonly apiKey: string;
  private readonly toolDefaults: ToolSessionDefaults;
  private lastKnownWidget?: string;

  constructor(apiKey?: string, toolDefaults?: ToolSessionDefaults) {
    this.repoRoot = getRepoRoot();
    this.apiKey = apiKey ?? process.env.CURSOR_API_KEY ?? "";
    this.toolDefaults = toolDefaults ?? {};
    if (!this.apiKey) {
      throw new Error("CURSOR_API_KEY is required");
    }
  }

  get agentId(): string | undefined {
    return this.agent?.agentId;
  }

  async createAgent(modelId = "composer-2.5"): Promise<string> {
    const store = resolveLocalAgentStore(this.repoRoot);
    const sandboxEnabled =
      process.env.CURSOR_SANDBOX_ENABLED === "1" ||
      process.env.CURSOR_SANDBOX_ENABLED === "true";

    this.agent = await Agent.create({
      apiKey: this.apiKey,
      model: { id: modelId },
      local: {
        cwd: this.repoRoot,
        settingSources: ["project"],
        customTools: createCustomTools(this.toolDefaults),
        ...(store ? { store } : {}),
        ...(sandboxEnabled ? { sandboxOptions: { enabled: true } } : {}),
      },
    });
    return this.agent.agentId;
  }

  async dispose(): Promise<void> {
    if (this.agent) {
      const agent = this.agent;
      this.agent = null;
      if (typeof agent[Symbol.asyncDispose] === "function") {
        await agent[Symbol.asyncDispose]();
      }
    }
  }

  private async ensureAgent(): Promise<SDKAgent> {
    if (!this.agent) {
      await this.createAgent();
    }
    return this.agent!;
  }

  resolveWidgetName(hint?: string): string | undefined {
    if (hint) {
      try {
        const path = getWidgetLuaPath(hint);
        if (existsSync(path)) {
          this.lastKnownWidget = hint;
          return hint;
        }
      } catch {
        // invalid hint
      }
    }
    if (this.lastKnownWidget) {
      const path = getWidgetLuaPath(this.lastKnownWidget);
      if (existsSync(path)) return this.lastKnownWidget;
    }
    const latest = findLatestWidgetName();
    if (latest) {
      this.lastKnownWidget = latest;
      return latest;
    }
    return undefined;
  }

  async generate(
    request: GenerateRequest,
    callbacks?: RunCallbacks,
    session?: GenerateSession
  ): Promise<{
    runId: string;
    agentId: string;
    status: string;
    success: boolean;
    result?: string;
    widgetName?: string;
    validated?: boolean;
    validationIssues?: ValidationIssue[];
  }> {
    const agent = await this.ensureAgent();
    const radio = loadRadioProfile(request.radioId);
    const catalog = loadTelemetryCatalog(request.protocol);

    const variationSeed =
      session?.variationSeed ??
      deriveVariationSeed(session?.id ?? request.prompt, session?.runIndex ?? 0);

    let assignedWidgetName = session?.widgetName;
    if (!assignedWidgetName) {
      assignedWidgetName = allocateWidgetName(request.prompt, request.protocol, variationSeed);
      if (session) {
        session.widgetName = assignedWidgetName;
      }
      this.toolDefaults.widgetName = assignedWidgetName;
      this.lastKnownWidget = assignedWidgetName;
    }

    const prompt = buildGenerationPrompt(
      request.prompt,
      radio,
      catalog,
      request.edgeTxVersion,
      session
        ? {
            sessionId: session.id,
            runIndex: session.runIndex ?? 0,
            variationSeed: session.variationSeed,
            assignedWidgetName,
          }
        : { sessionId: "cli", assignedWidgetName }
    );

    if (session) {
      session.layoutArchetypeId = getArchetypeForSession(
        request.prompt,
        request.protocol,
        {
          sessionId: session.id,
          runIndex: session.runIndex ?? 0,
          variationSeed: session.variationSeed,
        }
      );
    }

    callbacks?.onEvent?.({
      type: "status",
      content: `Starting generation (widget: ${assignedWidgetName})...`,
      agentId: agent.agentId,
    });
    callbacks?.onWidgetName?.(assignedWidgetName);

    const run = await agent.send(prompt);
    callbacks?.onEvent?.({
      type: "status",
      content: `Run started: ${run.id}`,
      runId: run.id,
      agentId: agent.agentId,
    });

    const streamed = await streamAgentRun(
      run,
      agent.agentId,
      callbacks,
      () => this.resolveWidgetName()
    );

    const runFinished = streamed.status === "finished";
    let validated = false;
    let validationIssues: ValidationIssue[] = [];

    if (streamed.widgetName && runFinished) {
      const finalization = await finalizeWidgetRun(
        streamed.widgetName,
        request.protocol,
        request.radioId,
        callbacks
      );
      validated = finalization.validated;
      validationIssues = finalization.validationIssues;
    }

    const success = runFinished && validated;

    return {
      runId: streamed.runId,
      agentId: agent.agentId,
      status: streamed.status,
      success,
      result: streamed.result,
      widgetName: streamed.widgetName,
      validated,
      validationIssues,
    };
  }

  async refine(
    prompt: string,
    protocol: TelemetryProtocol,
    radioId: string,
    widgetName?: string,
    callbacks?: RunCallbacks,
    session?: GenerateSession
  ): Promise<{
    runId: string;
    status: string;
    success: boolean;
    widgetName?: string;
    validated?: boolean;
    validationIssues?: ValidationIssue[];
  }> {
    const agent = await this.ensureAgent();

    if (session && shouldBumpRunIndexForRefine(prompt)) {
      session.runIndex = (session.runIndex ?? 0) + 1;
      session.variationSeed = deriveVariationSeed(session.id, session.runIndex);
    }

    const refinePrompt = buildRefinePrompt(
      prompt,
      widgetName,
      radioId,
      protocol,
      session
        ? {
            sessionId: session.id,
            runIndex: session.runIndex ?? 0,
            variationSeed: session.variationSeed,
          }
        : undefined
    );

    if (session) {
      session.layoutArchetypeId = getArchetypeForSession(prompt, protocol, {
        sessionId: session.id,
        runIndex: session.runIndex ?? 0,
        variationSeed: session.variationSeed,
      });
    }

    const run = await agent.send(refinePrompt);

    const streamed = await streamAgentRun(
      run,
      agent.agentId,
      callbacks,
      () => this.resolveWidgetName(widgetName)
    );

    const runFinished = streamed.status === "finished";
    let validated = false;
    let validationIssues: ValidationIssue[] = [];

    if (streamed.widgetName && runFinished) {
      const finalization = await finalizeWidgetRun(
        streamed.widgetName,
        protocol,
        radioId,
        callbacks
      );
      validated = finalization.validated;
      validationIssues = finalization.validationIssues;
    }

    const success = runFinished && validated;

    return {
      runId: streamed.runId,
      status: streamed.status,
      success,
      widgetName: streamed.widgetName,
      validated,
      validationIssues,
    };
  }
}

export { CursorAgentError };
