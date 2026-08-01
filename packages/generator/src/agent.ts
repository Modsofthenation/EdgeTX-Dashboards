import { Agent, CursorAgentError, type SDKAgent } from "@cursor/sdk";
import { randomUUID } from "node:crypto";
import type {
  AiProviderId,
  GenerateRequest,
  GenerateSession,
  TelemetryProtocol,
  ValidationIssue,
} from "@widget-gen/shared";
import { parseAiProviderId, providerMeta } from "@widget-gen/shared";
import {
  buildGenerationPrompt,
  buildRefinePrompt,
  getArchetypeForSession,
} from "./promptComposer.ts";
import { buildSdkUserMessage } from "./promptImages.ts";
import {
  shouldBumpRunIndexForRefine,
  deriveVariationSeed,
} from "./designVariation.ts";
import { allocateWidgetName } from "./widgetNaming.ts";
import { createCustomTools } from "./agentTools.ts";
import {
  getRepoRoot,
  loadRadioProfile,
  loadTelemetryCatalog,
} from "./knowledge.ts";
import { findLatestWidgetName, pickActiveWidgetName } from "./widgetResolve.ts";
import { existsSync } from "node:fs";
import { getWidgetLuaPathForKey } from "./paths.ts";
import {
  ensureWidgetInstanceDir,
  archiveWidgetVersion,
} from "./widgetInstance.ts";
import { resolveLocalAgentStore } from "./localAgentStore.ts";
import {
  finalizeWidgetRun,
  streamAgentRun,
  type RunCallbacks,
} from "./orchestrator.ts";
import type { ToolSessionDefaults } from "./agentTools.ts";
import type { RefineHistoryInput } from "./refineHistory.ts";
import { buildRefineHistorySections } from "./refineHistory.ts";
import { runProviderToolLoop } from "./providers/toolLoopAgent.ts";
import { defaultModelForProvider } from "./providers/providerModels.ts";
import { isCursorSandboxEnabled } from "./cursorSandbox.ts";

export type { RunCallbacks };

export class WidgetGenerator {
  private agent: SDKAgent | null = null;
  private httpAgentId: string | null = null;
  private httpModelId: string | null = null;
  private readonly repoRoot: string;
  private readonly apiKey: string;
  private readonly provider: AiProviderId;
  private readonly toolDefaults: ToolSessionDefaults;
  private lastKnownWorkspace?: string;

  constructor(
    apiKey?: string,
    toolDefaults?: ToolSessionDefaults,
    provider: AiProviderId = "cursor",
  ) {
    this.repoRoot = getRepoRoot();
    this.provider = parseAiProviderId(provider);
    const meta = providerMeta(this.provider);
    this.apiKey = apiKey ?? process.env[meta.envVar] ?? "";
    this.toolDefaults = toolDefaults ?? {};
    if (!this.apiKey) {
      throw new Error(
        `${meta.envVar} is required for provider "${this.provider}"`,
      );
    }
  }

  get agentId(): string | undefined {
    return this.agent?.agentId ?? this.httpAgentId ?? undefined;
  }

  get aiProvider(): AiProviderId {
    return this.provider;
  }

  async createAgent(
    modelId = defaultModelForProvider(this.provider),
  ): Promise<string> {
    if (this.provider !== "cursor") {
      this.httpModelId = modelId;
      this.httpAgentId = `${this.provider}-agent`;
      return this.httpAgentId;
    }

    const store = resolveLocalAgentStore(this.repoRoot);
    const sandboxEnabled = isCursorSandboxEnabled();

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

  private async ensureAgent(): Promise<SDKAgent | null> {
    if (this.provider !== "cursor") {
      if (!this.httpModelId) {
        await this.createAgent();
      }
      return null;
    }
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
    session?: GenerateSession,
    options?: { signal?: AbortSignal },
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
    const signal = options?.signal;
    const agent = await this.ensureAgent();
    const radio = loadRadioProfile(request.radioId);
    const catalog = loadTelemetryCatalog(request.protocol);

    const variationSeed =
      session?.variationSeed ??
      deriveVariationSeed(
        session?.id ?? request.prompt,
        session?.runIndex ?? 0,
      );

    const widgetInstanceId = session?.widgetInstanceId ?? randomUUID();
    const widgetVersion = session?.widgetVersion ?? 0;

    let assignedWidgetName = session?.widgetName;
    if (!assignedWidgetName) {
      assignedWidgetName = allocateWidgetName(
        request.prompt,
        request.protocol,
        variationSeed,
      );
    }

    if (session) {
      session.widgetInstanceId = widgetInstanceId;
      session.widgetVersion = widgetVersion;
      session.widgetName = assignedWidgetName;
    }

    ensureWidgetInstanceDir(
      widgetInstanceId,
      assignedWidgetName,
      widgetVersion,
    );

    this.toolDefaults.widgetInstanceId = widgetInstanceId;
    this.toolDefaults.widgetName = assignedWidgetName;
    this.toolDefaults.widgetVersion = widgetVersion;
    this.toolDefaults.protocol = request.protocol;
    this.toolDefaults.radioId = request.radioId;
    this.toolDefaults.userPrompt = request.prompt;
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
      promptCtx,
    );

    const layoutArchetypeId = getArchetypeForSession(
      request.prompt,
      request.protocol,
      session
        ? {
            sessionId: session.id,
            runIndex: session.runIndex ?? 0,
            variationSeed: session.variationSeed,
          }
        : {
            sessionId: "cli",
            runIndex: 0,
            variationSeed,
          },
    );
    this.toolDefaults.layoutArchetype = layoutArchetypeId;
    if (session) {
      session.layoutArchetypeId = layoutArchetypeId;
    }

    callbacks?.onEvent?.({
      type: "status",
      content: `Starting generation (${assignedWidgetName} v${widgetVersion})...`,
      agentId: this.agentId,
    });
    callbacks?.onWidgetWorkspace?.({
      instanceId: widgetInstanceId,
      displayName: assignedWidgetName,
      version: widgetVersion,
    });

    let streamed: {
      runId: string;
      status: string;
      result?: string;
    };

    if (this.provider !== "cursor") {
      const loop = await runProviderToolLoop({
        provider: this.provider,
        apiKey: this.apiKey,
        modelId: this.httpModelId ?? defaultModelForProvider(this.provider),
        userText: prompt,
        images: request.images,
        toolDefaults: this.toolDefaults,
        callbacks,
        signal,
      });
      this.httpAgentId = loop.agentId;
      streamed = {
        runId: loop.runId,
        status: loop.status,
        result: loop.result,
      };
      if (loop.status === "error" && loop.error) {
        callbacks?.onEvent?.({
          type: "error",
          content: loop.error,
          runId: loop.runId,
          agentId: loop.agentId,
        });
      }
      if (loop.status === "cancelled") {
        callbacks?.onEvent?.({
          type: "status",
          content: "Cancelled",
          runId: loop.runId,
          agentId: loop.agentId,
        });
      }
    } else {
      const cursorAgent = agent!;
      const run = await cursorAgent.send(
        buildSdkUserMessage(prompt, request.images),
      );
      callbacks?.onEvent?.({
        type: "status",
        content: `Run started: ${run.id}`,
        runId: run.id,
        agentId: cursorAgent.agentId,
      });
      streamed = await streamAgentRun(
        run,
        cursorAgent.agentId,
        callbacks,
        () => this.resolveWidgetWorkspaceKey(widgetInstanceId),
        signal,
      );
    }

    const runFinished = streamed.status === "finished";
    let validated = false;
    let validationIssues: ValidationIssue[] = [];
    const workspaceKey = widgetInstanceId;

    if (runFinished) {
      const finalization = await finalizeWidgetRun(
        workspaceKey,
        request.protocol,
        request.radioId,
        callbacks,
        {
          layoutArchetype: layoutArchetypeId,
          userPrompt: request.prompt,
        },
      );
      validated = finalization.validated;
      validationIssues = finalization.validationIssues;
    }

    const success = runFinished && validated;

    return {
      runId: streamed.runId,
      agentId: this.agentId ?? "",
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
    refineHistory?: RefineHistoryInput,
    options?: { signal?: AbortSignal },
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
    const signal = options?.signal;
    const agent = await this.ensureAgent();

    this.syncToolDefaults(session);

    const widgetInstanceId =
      session?.widgetInstanceId ?? this.toolDefaults.widgetInstanceId;
    const displayName =
      widgetName ?? session?.widgetName ?? this.toolDefaults.widgetName;

    if (displayName) {
      this.toolDefaults.widgetName = displayName;
    }
    if (widgetInstanceId) {
      this.toolDefaults.widgetInstanceId = widgetInstanceId;
      this.lastKnownWorkspace = widgetInstanceId;
    }
    this.toolDefaults.protocol = protocol;
    this.toolDefaults.radioId = radioId;
    this.toolDefaults.userPrompt = prompt;

    const prevVersion = session?.widgetVersion ?? 0;
    const nextVersion = prevVersion + 1;
    const restoreWidgetVersion = () => {
      if (!session) return;
      session.widgetVersion = prevVersion;
      this.toolDefaults.widgetVersion = prevVersion;
    };
    const runWithVersionRollback = async <T>(
      operation: () => Promise<T>,
    ): Promise<T> => {
      try {
        return await operation();
      } catch (error) {
        restoreWidgetVersion();
        throw error;
      }
    };

    if (session) {
      if (widgetInstanceId) {
        archiveWidgetVersion(widgetInstanceId, prevVersion);
      }
      session.widgetVersion = nextVersion;
      this.toolDefaults.widgetVersion = session.widgetVersion;
      if (widgetInstanceId && displayName) {
        try {
          ensureWidgetInstanceDir(
            widgetInstanceId,
            displayName,
            session.widgetVersion,
          );
        } catch (error) {
          restoreWidgetVersion();
          throw error;
        }
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
            refineHistory: refineHistory
              ? buildRefineHistorySections(refineHistory)
              : undefined,
          }
        : widgetInstanceId
          ? {
              sessionId: "refine",
              widgetInstanceId,
              widgetVersion: this.toolDefaults.widgetVersion,
              referenceImageCount: images?.length ?? 0,
              refineHistory: refineHistory
                ? buildRefineHistorySections(refineHistory)
                : undefined,
            }
          : {
              sessionId: "refine",
              referenceImageCount: images?.length ?? 0,
              refineHistory: refineHistory
                ? buildRefineHistorySections(refineHistory)
                : undefined,
            },
    );

    const layoutArchetypeId = getArchetypeForSession(prompt, protocol, {
      sessionId: session?.id ?? "refine",
      runIndex: session?.runIndex ?? 0,
      variationSeed: session?.variationSeed,
    });
    this.toolDefaults.layoutArchetype = layoutArchetypeId;
    if (session) {
      session.layoutArchetypeId = layoutArchetypeId;
    }

    if (widgetInstanceId && displayName) {
      callbacks?.onWidgetWorkspace?.({
        instanceId: widgetInstanceId,
        displayName,
        version: session?.widgetVersion ?? this.toolDefaults.widgetVersion ?? 0,
      });
    }

    let streamed: {
      runId: string;
      status: string;
      result?: string;
      widgetName?: string;
    };

    const provider = this.provider;
    if (provider !== "cursor") {
      const loop = await runWithVersionRollback(() =>
        runProviderToolLoop({
          provider,
          apiKey: this.apiKey,
          modelId: this.httpModelId ?? defaultModelForProvider(provider),
          userText: refinePrompt,
          images,
          toolDefaults: this.toolDefaults,
          callbacks,
          signal,
        }),
      );
      this.httpAgentId = loop.agentId;
      streamed = {
        runId: loop.runId,
        status: loop.status,
        result: loop.result,
      };
      if (loop.status === "error" && loop.error) {
        callbacks?.onEvent?.({
          type: "error",
          content: loop.error,
          runId: loop.runId,
          agentId: loop.agentId,
        });
      }
      if (loop.status === "cancelled") {
        callbacks?.onEvent?.({
          type: "status",
          content: "Cancelled",
          runId: loop.runId,
          agentId: loop.agentId,
        });
      }
    } else {
      const cursorAgent = agent!;
      const run = await runWithVersionRollback(() =>
        cursorAgent.send(buildSdkUserMessage(refinePrompt, images)),
      );
      streamed = await runWithVersionRollback(() =>
        streamAgentRun(
          run,
          cursorAgent.agentId,
          callbacks,
          () => this.resolveWidgetWorkspaceKey(widgetInstanceId),
          signal,
        ),
      );
    }

    const runFinished = streamed.status === "finished";
    let validated = false;
    let validationIssues: ValidationIssue[] = [];
    const workspaceKey = widgetInstanceId ?? streamed.widgetName;

    if (workspaceKey && runFinished) {
      const finalization = await runWithVersionRollback(() =>
        finalizeWidgetRun(workspaceKey, protocol, radioId, callbacks, {
          layoutArchetype: layoutArchetypeId,
          userPrompt: prompt,
        }),
      );
      validated = finalization.validated;
      validationIssues = finalization.validationIssues;
    }

    const success = runFinished && validated;
    if (session) {
      if (success) {
        session.widgetVersion = nextVersion;
        this.toolDefaults.widgetVersion = nextVersion;
      } else {
        restoreWidgetVersion();
      }
    }

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
