/** Server-Sent Events helpers for widget generation API routes. */

export function sseEncode(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

/** Avoid leaking absolute filesystem paths over SSE. */
export function sanitizeSseErrorMessage(message: string): string {
  return message
    .replace(/[A-Za-z]:\\(?:[^\s"'`]+)/g, "[path]")
    .replace(
      /\/(?:Users|home|tmp|var|opt|workspace)(?:\/[^\s"'`]+)+/g,
      "[path]",
    )
    .trim()
    .slice(0, 500);
}

function errorContent(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return sanitizeSseErrorMessage(error.message);
  }
  if (typeof error === "string" && error.trim()) {
    return sanitizeSseErrorMessage(error);
  }
  return "Unknown streaming error";
}

export function createSseResponse(
  stream: ReadableStream<Uint8Array>,
): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export function createSseStream(
  handler: (send: (data: object) => void) => Promise<void>,
  options?: { signal?: AbortSignal },
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      const send = (data: object) => {
        if (closed || options?.signal?.aborted) return;
        try {
          controller.enqueue(encoder.encode(sseEncode(data)));
        } catch {
          closed = true;
        }
      };

      const onAbort = () => {
        close();
      };
      options?.signal?.addEventListener("abort", onAbort);

      try {
        await handler(send);
      } catch (error) {
        console.error("[sse] handler failed:", error);
        if (!options?.signal?.aborted) {
          send({
            type: "error",
            content: errorContent(error),
            success: false,
          });
        }
      } finally {
        options?.signal?.removeEventListener("abort", onAbort);
        close();
      }
    },
    cancel() {
      // Client disconnected — request.signal also aborts when applicable.
    },
  });
}
