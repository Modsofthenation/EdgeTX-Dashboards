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
  reset: (reason?: string) => void;
  /** True while a deploy is in flight (including draining coalesced jobs). */
  isRunning: () => boolean;
};

export function createLoadWidgetCoalescer<TZone = unknown>(options: {
  run: (job: LoadWidgetJob<TZone>) => Promise<void>;
  onResult: (requestId: number, result: LoadWidgetResult) => void;
}): LoadWidgetCoalescer<TZone> {
  let latest: LoadWidgetJob<TZone> | null = null;
  let running = false;

  const settle = (requestId: number, result: LoadWidgetResult) => {
    options.onResult(requestId, result);
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
    if (latest) void pump();
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
    },
    isRunning: () => running || latest != null,
  };
}
