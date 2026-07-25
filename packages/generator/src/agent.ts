import { Agent, CursorAgentError, type SDKAgent } from "@cursor/sdk";
import { randomUUID } from "node:crypto";
import type { GenerateRequest, GenerateSession, TelemetryProtocol, ValidationIssue } from "@widget-gen/shared";
import { buildGenerationPrompt, buildRefinePrompt, getArchetypeForSession } from "./promptComposer.ts";
import { buildSdkUserMessage } from "./promptImages.ts";
import { shouldBumpRunIndexForRefine, deriveVariationSeed } from "./designVariation.ts";
import { allocateWidgetName } from "./widgetNaming.ts";
import { createCustomTools } from "./agentTools.ts";
import { getRepoRoot, loadRadioProfile, loadTelemetryCatalog } from "./knowledge.ts";
import { findLatestWidgetName, pickActiveWidgetName } from "./widgetResolve.ts";
import { existsSync } from "node:fs";
import { getWidgetLuaPathForKey } from "./paths.ts";
import { ensureWidgetInstanceDir, archiveWidgetVersion } from "./widgetInstance.ts";
import { resolveLocalAgentStore } from "./localAgentStore.ts";
import {
  finalizeWidgetRun,
  streamAgentRun,
  type RunCallbacks,
} from "./orchestrator.ts";
import type { ToolSessionDefaults } from "./agentTools.ts";
import type { RefineHistoryInput } from "./refineHistory.ts";
import { buildRefineHistorySections } from "./refineHistory.ts";

export type { RunCallbacks };

export class WidgetGenerator {
  private agent: SDKAgent | null = null;
  private readonly repoRoot: string;
  private readonly apiKey: string;
  private readonly toolDefaults: ToolSessionDefaults;
  private lastKnownWorkspace?: string;

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
        // Rules are inlined in generation/refine prompts — avoid double-loading project rules.
        settingSources: [],
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
    return this.resolveWidgetWorkspaceKey(hint);
  }

  resolveWidgetWorkspaceKey(hint?: string): string | undefined {
    const key = pickActiveWidgetName({
      hint,
      assignedInstanceId: this.toolDefaults.widgetInstanceId,
      assigned: this.toolDefaults.widgetName,
      lastKnown: this.lastKnownWorkspace,
      exists: (candidate) => {
        try {
          return existsSync(getWidgetLuaPathForKey(candidate));
        } catch {
          return false;
        }
      },
      latest: () => findLatestWidgetName(),
    });
    if (key) this.lastKnownWorkspace = key;
    return key;
  }

  private syncToolDefaults(session?: GenerateSession): void {
    if (session?.widgetInstanceId) {
      this.toolDefaults.widgetInstanceId = session.widgetInstanceId;
    }
    if (session?.widgetName) {
      this.toolDefaults.widgetName = session.widgetName;
    }
    if (session?.widgetVersion !== undefined) {
      this.toolDefaults.widgetVersion = session.widgetVersion;
    }
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
    widgetInstanceId?: string;
    widgetVersion?: number;
    validated?: boolean;
    validationIssues?: ValidationIssue[];
  }> {
    const agent = await this.ensureAgent();
    const radio = loadRadioProfile(request.radioId);
    const catalog = loadTelemetryCatalog(request.protocol);

    const variationSeed =
      session?.variationSeed ??
      deriveVariationSeed(session?.id ?? request.prompt, session?.runIndex ?? 0);

    const widgetInstanceId = session?.widgetInstanceId ?? randomUUID();
    const widgetVersion = session?.widgetVersion ?? 0;

    let assignedWidgetName = session?.widgetName;
    if (!assignedWidgetName) {
      assignedWidgetName = allocateWidgetName(request.prompt, request.protocol, variationSeed);
    }

    if (session) {
      session.widgetInstanceId = widgetInstanceId;
      session.widgetVersion = widgetVersion;
      session.widgetName = assignedWidgetName;
    }

    ensureWidgetInstanceDir(widgetInstanceId, assignedWidgetName, widgetVersion);

    this.toolDefaults.widgetInstanceId = widgetInstanceId;
    this.toolDefaults.widgetName = assignedWidgetName;
    this.toolDefaults.widgetVersion = widgetVersion;
    this.lastKnownWorkspace = widgetInstanceId;

    const promptCtx = session
        ? {
            sessionId: session.id,
            runIndex: session.runIndex ?? 0,
            variationSeed: session.variationSeed,
            assignedWidgetName,
            widgetInstanceId,
            widgetVersion,
            referenceImageCount: request.images?.length ?? 0,
          }
        : {
            sessionId: "cli",
            assignedWidgetName,
            widgetInstanceId,
            widgetVersion,
            referenceImageCount: request.images?.length ?? 0,
          };

    const prompt = buildGenerationPrompt(
      request.prompt,
      radio,
      catalog,
      request.edgeTxVersion,
      promptCtx
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
      content: `Starting generation (${assignedWidgetName} v${widgetVersion})...`,
      agentId: agent.agentId,
    });
    callbacks?.onWidgetWorkspace?.({
      instanceId: widgetInstanceId,
      displayName: assignedWidgetName,
      version: widgetVersion,
    });

    const run = await agent.send(buildSdkUserMessage(prompt, request.images));
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
      () => this.resolveWidgetWorkspaceKey(widgetInstanceId)
    );

    const runFinished = streamed.status === "finished";
    let validated = false;
    let validationIssues: ValidationIssue[] = [];
    const workspaceKey = widgetInstanceId;

    if (runFinished) {
      const finalization = await finalizeWidgetRun(
        workspaceKey,
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
      widgetName: assignedWidgetName,
      widgetInstanceId,
      widgetVersion,
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
    session?: GenerateSession,
    images?: GenerateRequest["images"],
    refineHistory?: RefineHistoryInput
  ): Promise<{
    runId: string;
    status: string;
    success: boolean;
    widgetName?: string;
    widgetInstanceId?: string;
    widgetVersion?: number;
    validated?: boolean;
    validationIssues?: ValidationIssue[];
  }> {
    const agent = await this.ensureAgent();

    this.syncToolDefaults(session);

    const widgetInstanceId = session?.widgetInstanceId ?? this.toolDefaults.widgetInstanceId;
    const displayName = widgetName ?? session?.widgetName ?? this.toolDefaults.widgetName;

    if (displayName) {
      this.toolDefaults.widgetName = displayName;
    }
    if (widgetInstanceId) {
      this.toolDefaults.widgetInstanceId = widgetInstanceId;
      this.lastKnownWorkspace = widgetInstanceId;
    }

    if (session) {
      if (widgetInstanceId) {
        const prevVersion = session.widgetVersion ?? 0;
        archiveWidgetVersion(widgetInstanceId, prevVersion);
        session.widgetVersion = prevVersion + 1;
      } else {
        session.widgetVersion = (session.widgetVersion ?? 0) + 1;
      }
      this.toolDefaults.widgetVersion = session.widgetVersion;
      if (widgetInstanceId && displayName) {
        ensureWidgetInstanceDir(widgetInstanceId, displayName, session.widgetVersion);
      }
    }

    if (session && shouldBumpRunIndexForRefine(prompt)) {
      session.runIndex = (session.runIndex ?? 0) + 1;
      session.variationSeed = deriveVariationSeed(session.id, session.runIndex);
    }

    const refinePrompt = buildRefinePrompt(
      prompt,
      displayName,
      radioId,
      protocol,
      session
        ? {
            sessionId: session.id,
            runIndex: session.runIndex ?? 0,
            variationSeed: session.variationSeed,
            widgetInstanceId: session.widgetInstanceId,
            widgetVersion: session.widgetVersion,
            referenceImageCount: images?.length ?? 0,
            refineHistory: refineHistory ? buildRefineHistorySections(refineHistory) : undefined,
          }
        : widgetInstanceId
          ? {
              sessionId: "refine",
              widgetInstanceId,
              widgetVersion: this.toolDefaults.widgetVersion,
              referenceImageCount: images?.length ?? 0,
              refineHistory: refineHistory ? buildRefineHistorySections(refineHistory) : undefined,
            }
          : {
              sessionId: "refine",
              referenceImageCount: images?.length ?? 0,
              refineHistory: refineHistory ? buildRefineHistorySections(refineHistory) : undefined,
            }
    );

    if (session) {
      session.layoutArchetypeId = getArchetypeForSession(prompt, protocol, {
        sessionId: session.id,
        runIndex: session.runIndex ?? 0,
        variationSeed: session.variationSeed,
      });
    }

    if (widgetInstanceId && displayName) {
      callbacks?.onWidgetWorkspace?.({
        instanceId: widgetInstanceId,
        displayName,
        version: session?.widgetVersion ?? this.toolDefaults.widgetVersion ?? 0,
      });
    }

    const run = await agent.send(buildSdkUserMessage(refinePrompt, images));

    const streamed = await streamAgentRun(
      run,
      agent.agentId,
      callbacks,
      () => this.resolveWidgetWorkspaceKey(widgetInstanceId)
    );

    const runFinished = streamed.status === "finished";
    let validated = false;
    let validationIssues: ValidationIssue[] = [];
    const workspaceKey = widgetInstanceId ?? streamed.widgetName;

    if (workspaceKey && runFinished) {
      const finalization = await finalizeWidgetRun(workspaceKey, protocol, radioId, callbacks);
      validated = finalization.validated;
      validationIssues = finalization.validationIssues;
    }

    const success = runFinished && validated;

    return {
      runId: streamed.runId,
      status: streamed.status,
      success,
      widgetName: displayName ?? streamed.widgetName,
      widgetInstanceId,
      widgetVersion: session?.widgetVersion,
      validated,
      validationIssues,
    };
  }
}

export { CursorAgentError };
