import { randomUUID } from "node:crypto";
import type { PromptImage, StreamEvent } from "@widget-gen/shared";
import type { AiProviderId } from "@widget-gen/shared";
import { describeToolUse } from "../toolDisplay.ts";
import type { RunCallbacks } from "../orchestrator.ts";
import {
  createHttpTools,
  httpToolsSystemAddendum,
  type HttpToolDefinition,
} from "./httpTools.ts";
import type { ToolSessionDefaults } from "../agentTools.ts";

const MAX_TURNS = 24;

export interface ToolLoopResult {
  runId: string;
  agentId: string;
  status: "finished" | "error" | "cancelled";
  result?: string;
  error?: string;
}

type ChatContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

function emitTool(
  callbacks: RunCallbacks | undefined,
  name: string,
  args: unknown,
  runId: string,
  agentId: string,
): void {
  const info = describeToolUse(name, args);
  callbacks?.onEvent?.({
    type: "tool",
    content: info.label,
    detail: info.detail,
    toolName: name,
    runId,
    agentId,
  });
}

function imagesToDataUrls(images?: PromptImage[]): string[] {
  if (!images?.length) return [];
  return images.map((img) => {
    const mime = img.mimeType || "image/png";
    return `data:${mime};base64,${img.data}`;
  });
}

async function runOpenAiLoop(opts: {
  apiKey: string;
  modelId: string;
  userText: string;
  images?: PromptImage[];
  tools: HttpToolDefinition[];
  callbacks?: RunCallbacks;
  runId: string;
  agentId: string;
  signal?: AbortSignal;
}): Promise<ToolLoopResult> {
  const { apiKey, modelId, tools, callbacks, runId, agentId, signal } = opts;
  type Message = {
    role: "system" | "user" | "assistant" | "tool";
    content?: string | ChatContent[];
    tool_calls?: Array<{
      id: string;
      type: "function";
      function: { name: string; arguments: string };
    }>;
    tool_call_id?: string;
    name?: string;
  };

  const system = httpToolsSystemAddendum();
  const dataUrls = imagesToDataUrls(opts.images);
  const userContent: ChatContent[] = [{ type: "text", text: opts.userText }];
  for (const url of dataUrls) {
    userContent.push({ type: "image_url", image_url: { url } });
  }

  const messages: Message[] = [
    { role: "system", content: system },
    {
      role: "user",
      content: dataUrls.length > 0 ? userContent : opts.userText,
    },
  ];

  const openaiTools = tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  let assistantText = "";

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    if (signal?.aborted) {
      return { status: "cancelled", runId, agentId, error: "Cancelled" };
    }

    callbacks?.onEvent?.({
      type: "status",
      content: `OpenAI turn ${turn + 1}…`,
      runId,
      agentId,
    });

    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: modelId,
          messages,
          tools: openaiTools,
          tool_choice: "auto",
        }),
        signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return { status: "cancelled", runId, agentId, error: "Cancelled" };
      }
      throw error;
    }

    if (!response.ok) {
      const body = await response.text();
      return {
        runId,
        agentId,
        status: "error",
        error: `OpenAI API ${response.status}: ${body.slice(0, 400)}`,
      };
    }

    const data = (await response.json()) as {
      choices?: Array<{
        message?: Message;
        finish_reason?: string;
      }>;
    };
    const message = data.choices?.[0]?.message;
    if (!message) {
      return {
        runId,
        agentId,
        status: "error",
        error: "OpenAI returned no message",
      };
    }

    messages.push(message);
    if (typeof message.content === "string" && message.content.trim()) {
      assistantText += message.content;
      callbacks?.onEvent?.({
        type: "text",
        content: message.content,
        runId,
        agentId,
      });
    }

    const toolCalls = message.tool_calls ?? [];
    if (toolCalls.length === 0) {
      return { runId, agentId, status: "finished", result: assistantText };
    }

    for (const call of toolCalls) {
      const name = call.function.name;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}") as Record<
          string,
          unknown
        >;
      } catch {
        args = {};
      }
      emitTool(callbacks, name, args, runId, agentId);
      const tool = tools.find((t) => t.name === name);
      const result = tool
        ? await tool.execute(args)
        : { text: `Unknown tool: ${name}`, isError: true };
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        name,
        content: result.isError ? `ERROR: ${result.text}` : result.text,
      });
    }
  }

  return {
    runId,
    agentId,
    status: "error",
    error: `Exceeded ${MAX_TURNS} tool turns`,
    result: assistantText,
  };
}

async function runAnthropicLoop(opts: {
  apiKey: string;
  modelId: string;
  userText: string;
  images?: PromptImage[];
  tools: HttpToolDefinition[];
  callbacks?: RunCallbacks;
  runId: string;
  agentId: string;
  signal?: AbortSignal;
}): Promise<ToolLoopResult> {
  const { apiKey, modelId, tools, callbacks, runId, agentId, signal } = opts;

  type ContentBlock =
    | { type: "text"; text: string }
    | {
        type: "image";
        source: { type: "base64"; media_type: string; data: string };
      }
    | { type: "tool_use"; id: string; name: string; input: unknown }
    | {
        type: "tool_result";
        tool_use_id: string;
        content: string;
        is_error?: boolean;
      };

  type Message = {
    role: "user" | "assistant";
    content: string | ContentBlock[];
  };

  const system = httpToolsSystemAddendum();
  const userBlocks: ContentBlock[] = [];
  for (const img of opts.images ?? []) {
    userBlocks.push({
      type: "image",
      source: {
        type: "base64",
        media_type: img.mimeType || "image/png",
        data: img.data,
      },
    });
  }
  userBlocks.push({ type: "text", text: opts.userText });

  const messages: Message[] = [{ role: "user", content: userBlocks }];

  const anthropicTools = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));

  let assistantText = "";

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    if (signal?.aborted) {
      return { status: "cancelled", runId, agentId, error: "Cancelled" };
    }

    callbacks?.onEvent?.({
      type: "status",
      content: `Anthropic turn ${turn + 1}…`,
      runId,
      agentId,
    });

    let response: Response;
    try {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: modelId,
          max_tokens: 8192,
          system,
          messages,
          tools: anthropicTools,
        }),
        signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return { status: "cancelled", runId, agentId, error: "Cancelled" };
      }
      throw error;
    }

    if (!response.ok) {
      const body = await response.text();
      return {
        runId,
        agentId,
        status: "error",
        error: `Anthropic API ${response.status}: ${body.slice(0, 400)}`,
      };
    }

    const data = (await response.json()) as {
      content?: ContentBlock[];
      stop_reason?: string;
    };
    const content = data.content ?? [];
    messages.push({ role: "assistant", content });

    const toolUses: Array<{
      id: string;
      name: string;
      input: Record<string, unknown>;
    }> = [];

    for (const block of content) {
      if (block.type === "text" && block.text.trim()) {
        assistantText += block.text;
        callbacks?.onEvent?.({
          type: "text",
          content: block.text,
          runId,
          agentId,
        } satisfies StreamEvent);
      }
      if (block.type === "tool_use") {
        toolUses.push({
          id: block.id,
          name: block.name,
          input: (block.input ?? {}) as Record<string, unknown>,
        });
      }
    }

    if (toolUses.length === 0) {
      return { runId, agentId, status: "finished", result: assistantText };
    }

    const toolResults: ContentBlock[] = [];
    for (const call of toolUses) {
      emitTool(callbacks, call.name, call.input, runId, agentId);
      const tool = tools.find((t) => t.name === call.name);
      const result = tool
        ? await tool.execute(call.input)
        : { text: `Unknown tool: ${call.name}`, isError: true };
      toolResults.push({
        type: "tool_result",
        tool_use_id: call.id,
        content: result.text,
        is_error: result.isError,
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  return {
    runId,
    agentId,
    status: "error",
    error: `Exceeded ${MAX_TURNS} tool turns`,
    result: assistantText,
  };
}

export async function runProviderToolLoop(opts: {
  provider: Exclude<AiProviderId, "cursor">;
  apiKey: string;
  modelId: string;
  userText: string;
  images?: PromptImage[];
  toolDefaults?: ToolSessionDefaults;
  callbacks?: RunCallbacks;
  signal?: AbortSignal;
}): Promise<ToolLoopResult> {
  const runId = randomUUID();
  const agentId = `${opts.provider}-agent`;
  const tools = createHttpTools(opts.toolDefaults);

  if (opts.provider === "openai") {
    return runOpenAiLoop({ ...opts, tools, runId, agentId });
  }
  return runAnthropicLoop({ ...opts, tools, runId, agentId });
}
