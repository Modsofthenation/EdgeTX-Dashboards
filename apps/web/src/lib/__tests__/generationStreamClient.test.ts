import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { consumeGenerationStream } from "../generationStreamClient.js";

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(stream);
}

describe("consumeGenerationStream", () => {
  it("parses multiple SSE data frames", async () => {
    const events: unknown[] = [];
    await consumeGenerationStream({
      response: sseResponse([
        'data: {"type":"status","content":"ready"}\n\n',
        'data: {"type":"text","content":"hello"}\n\n',
        'data: {"type":"done","content":"ok","success":true}\n\n',
      ]),
      onPayload: (data) => events.push(data),
    });

    assert.equal(events.length, 3);
    assert.deepEqual(events[0], { type: "status", content: "ready" });
    assert.deepEqual(events[2], { type: "done", content: "ok", success: true });
  });

  it("buffers partial frames across chunks", async () => {
    const events: unknown[] = [];
    await consumeGenerationStream({
      response: sseResponse([
        'data: {"type":"text","con',
        'tent":"partial"}\n\n',
      ]),
      onPayload: (data) => events.push(data),
    });

    assert.equal(events.length, 1);
    assert.deepEqual(events[0], { type: "text", content: "partial" });
  });

  it("skips malformed JSON without throwing", async () => {
    const events: unknown[] = [];
    await consumeGenerationStream({
      response: sseResponse([
        "data: not-json\n\n",
        'data: {"type":"text","content":"ok"}\n\n',
      ]),
      onPayload: (data) => events.push(data),
    });

    assert.equal(events.length, 1);
    assert.equal((events[0] as { content: string }).content, "ok");
  });
});
