/** Server-Sent Events helpers for widget generation API routes. */

export function sseEncode(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`;
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
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(sseEncode(data)));
      };
      try {
        await handler(send);
      } finally {
        controller.close();
      }
    },
  });
}
