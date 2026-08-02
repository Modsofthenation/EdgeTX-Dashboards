import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createLoadWidgetCoalescer } from "./loadWidgetCoalesce.ts";

describe("createLoadWidgetCoalescer", () => {
  it("runs only the latest job when several enqueue during a deploy", async () => {
    const ran: number[] = [];
    const results: Array<{ id: number; ok: boolean }> = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const coalescer = createLoadWidgetCoalescer({
      run: async (job) => {
        ran.push(job.requestId);
        if (job.requestId === 1) await gate;
      },
      onResult: (requestId, result) => {
        results.push({ id: requestId, ok: result.ok });
      },
    });

    coalescer.enqueue({ source: "a", requestId: 1 });
    coalescer.enqueue({ source: "b", requestId: 2 });
    coalescer.enqueue({ source: "c", requestId: 3 });
    release();

    // Drain microtasks / promise continuations.
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 0));
    }

    assert.deepEqual(ran, [1, 3]);
    assert.deepEqual(results, [
      { id: 2, ok: true },
      { id: 1, ok: true },
      { id: 3, ok: true },
    ]);
  });

  it("recovers after a failed deploy so later jobs still run", async () => {
    const ran: number[] = [];
    const results: Array<{ id: number; ok: boolean; error?: string }> = [];

    const coalescer = createLoadWidgetCoalescer({
      run: async (job) => {
        ran.push(job.requestId);
        if (job.requestId === 1) throw new Error("boom");
      },
      onResult: (requestId, result) => {
        results.push(
          result.ok
            ? { id: requestId, ok: true }
            : { id: requestId, ok: false, error: result.error },
        );
      },
    });

    coalescer.enqueue({ source: "a", requestId: 1 });
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r, 0));
    }
    coalescer.enqueue({ source: "b", requestId: 2 });
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r, 0));
    }

    assert.deepEqual(ran, [1, 2]);
    assert.equal(results[0]?.ok, false);
    assert.equal(results[0]?.error, "boom");
    assert.equal(results[1]?.ok, true);
  });

  it("reset settles a waiting coalesced job without running it", async () => {
    const ran: number[] = [];
    const results: Array<{ id: number; ok: boolean; error?: string }> = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const coalescer = createLoadWidgetCoalescer({
      run: async (job) => {
        ran.push(job.requestId);
        if (job.requestId === 1) await gate;
      },
      onResult: (requestId, result) => {
        results.push(
          result.ok
            ? { id: requestId, ok: true }
            : { id: requestId, ok: false, error: result.error },
        );
      },
    });

    coalescer.enqueue({ source: "a", requestId: 1 });
    coalescer.enqueue({ source: "b", requestId: 2 });
    coalescer.reset("disposed");
    release();
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 0));
    }

    assert.deepEqual(ran, [1]);
    assert.ok(
      results.some((r) => r.id === 2 && !r.ok && r.error === "disposed"),
    );
    assert.ok(results.some((r) => r.id === 1 && r.ok));
  });
});
