import type { StreamEvent, ValidationIssue } from "@widget-gen/shared";

/** SSE payload from /api/generate and /api/refine (extends shared StreamEvent). */
export interface GenerationSsePayload extends Omit<StreamEvent, "type"> {
  type: StreamEvent["type"] | "widget";
  sessionId?: string;
  widgetName?: string;
  success?: boolean;
  validated?: boolean;
  validationIssues?: ValidationIssue[];
}

export interface ConsumeGenerationStreamOptions {
  response: Response;
  signal?: AbortSignal;
  onPayload: (data: GenerationSsePayload) => void;
}

/** Parse an SSE response body from generation API routes. */
export async function consumeGenerationStream({
  response,
  signal,
  onPayload,
}: ConsumeGenerationStreamOptions): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        if (!part.startsWith("data: ")) continue;
        try {
          onPayload(JSON.parse(part.slice(6)) as GenerationSsePayload);
        } catch {
          // skip malformed SSE chunk
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
