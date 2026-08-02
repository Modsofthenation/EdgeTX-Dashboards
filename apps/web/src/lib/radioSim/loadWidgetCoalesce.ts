/**
 * Latest-wins coalescer for radio-sim `loadWidget` jobs.
 *
 * The worker command queue is serial: without this, every editor edit awaits a
 * full deploy even when newer sources are already queued. Superseded jobs
 * resolve successfully so callers are not left hanging.
 */

export type LoadWidgetJob<TZone = unknown> = {
  source: string;
  zone?: TZone;
  requestId: number;
  modelPng?: ArrayBuffer;
};

export type LoadWidgetResult = { ok: true } | { ok: false; error: string };

export type LoadWidgetCoalescer<TZone = unknown> = {
  enqueue: (job: LoadWidgetJob<TZone>) => void;
  /**
   * Rejects the queued (not-yet-started) job, if any. Does **not** cancel or
   * await a job already inside `run()` — callers that tear down shared
   * dependencies used by `run()` must also `await whenIdle()`.
   */
  reset: (reason?: string) => void;
  /** True while a deploy is in flight (including draining coalesced jobs). */
  isRunning: () => boolean;
  /** Resolves once no job is queued or inside `run()`. */
  whenIdle: () => Promise<void>;
};

export function createLoadWidgetCoalescer<TZone = unknown>(options: {
  run: (job: LoadWidgetJob<TZone>) => Promise<void>;
  onResult: (requestId: number, result: LoadWidgetResult) => void;
}): LoadWidgetCoalescer<TZone> {
  let latest: LoadWidgetJob<TZone> | null = null;
  let running = false;
  let idleWaiters: Array<() => void> = [];

  const settle = (requestId: number, result: LoadWidgetResult) => {
    options.onResult(requestId, result);
  };

  const notifyIdle = () => {
    if (running || latest != null) return;
    const waiters = idleWaiters;
    idleWaiters = [];
    for (const wake of waiters) wake();
  };

  const pump = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      while (latest) {
        const job = latest;
        latest = null;
        try {
          await options.run(job);
          settle(job.requestId, { ok: true });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          settle(job.requestId, { ok: false, error: message });
        }
      }
    } finally {
      running = false;
    }
    // A job may have been enqueued after the while drained but before
    // `running` flipped false — kick another pass if so.
    if (latest) {
      void pump();
    } else {
      notifyIdle();
    }
  };

  return {
    enqueue(job) {
      if (latest) {
        settle(latest.requestId, { ok: true });
      }
      latest = job;
      void pump();
    },
    reset(reason = "cancelled") {
      if (latest) {
        settle(latest.requestId, { ok: false, error: reason });
        latest = null;
      }
      notifyIdle();
    },
    isRunning: () => running || latest != null,
    whenIdle() {
      if (!running && latest == null) return Promise.resolve();
      return new Promise<void>((resolve) => {
        idleWaiters.push(resolve);
      });
    },
  };
}
