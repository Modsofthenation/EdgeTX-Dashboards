import { Agent, CursorAgentError, type SDKAgent } from "@cursor/sdk";
import type { GenerateRequest, TelemetryProtocol, ValidationIssue } from "@widget-gen/shared";
import { buildGenerationPrompt, buildRefinePrompt, createCustomTools } from "./tools.js";
import { getRepoRoot, loadRadioProfile, loadTelemetryCatalog } from "./knowledge.js";
import { findLatestWidgetName } from "./widgetResolve.js";
import { existsSync } from "node:fs";
import { getWidgetLuaPath } from "./paths.js";
import {
  finalizeWidgetRun,
  streamAgentRun,
  type RunCallbacks,
} from "./orchestrator.js";

export type { RunCallbacks };

export class WidgetGenerator {
  private agent: SDKAgent | null = null;
  private readonly repoRoot: string;
  private readonly apiKey: string;
  private lastKnownWidget?: string;

  constructor(apiKey?: string) {
    this.repoRoot = getRepoRoot();
    this.apiKey = apiKey ?? process.env.CURSOR_API_KEY ?? "";
    if (!this.apiKey) {
      throw new Error("CURSOR_API_KEY is required");
    }
  }

  get agentId(): string | undefined {
    return this.agent?.agentId;
  }

  async createAgent(): Promise<string> {
    this.agent = await Agent.create({
      apiKey: this.apiKey,
      model: { id: "composer-2.5" },
      local: {
        cwd: this.repoRoot,
        settingSources: ["project"],
        sandboxOptions: { enabled: true },
        customTools: createCustomTools(),
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
    callbacks?: RunCallbacks
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
    const prompt = buildGenerationPrompt(
      request.prompt,
      radio,
      catalog,
      request.edgeTxVersion
    );

    callbacks?.onEvent?.({
      type: "status",
      content: "Starting generation...",
      agentId: agent.agentId,
    });

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

    callbacks?.onEvent?.({
      type: success ? "done" : "error",
      content: success
        ? `Generation finished and validated: ${streamed.widgetName}`
        : runFinished
          ? `Generation finished but validation failed for ${streamed.widgetName ?? "widget"}`
          : `Generation failed (run ${streamed.runId})`,
      runId: streamed.runId,
      agentId: agent.agentId,
    });

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
    callbacks?: RunCallbacks
  ): Promise<{
    runId: string;
    status: string;
    success: boolean;
    widgetName?: string;
    validated?: boolean;
    validationIssues?: ValidationIssue[];
  }> {
    const agent = await this.ensureAgent();
    const run = await agent.send(buildRefinePrompt(prompt, widgetName));

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
