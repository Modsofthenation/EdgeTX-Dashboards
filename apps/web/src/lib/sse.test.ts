import assert from "node:assert/strict";
import { test } from "node:test";
import { createSseStream } from "./sse.ts";

test("closes the stream cleanly when the handler rejects", async (t) => {
  const failure = new Error("handler failed");
  const logged: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => {
    logged.push(args);
  });

  const stream = createSseStream(async () => {
    throw failure;
  });

  const reader = stream.getReader();
  const first = await reader.read();
  assert.equal(first.done, false);
  const text = new TextDecoder().decode(first.value);
  assert.match(text, /"type":"error"/);
  assert.match(text, /handler failed/);
  assert.match(text, /"success":false/);

  assert.deepEqual(await reader.read(), {
    value: undefined,
    done: true,
  });
  assert.deepEqual(logged, [["[sse] handler failed:", failure]]);
});
