/** Latest-wins frame gate for WASM LCD transfers (default ~30 Hz). */
export const FRAME_MIN_INTERVAL_MS = 33;

export type FrameThrottleClock = {
  now: () => number;
  setTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeout: (id: ReturnType<typeof setTimeout>) => void;
};

const defaultClock: FrameThrottleClock = {
  now: () => performance.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
};

/**
 * Drop intermediate frames; keep the newest pending and emit a trailing
 * frame so motion stays smooth under the interval cap.
 */
export function createFrameThrottle<T>(
  emit: (frame: T) => void,
  intervalMs = FRAME_MIN_INTERVAL_MS,
  clock: FrameThrottleClock = defaultClock,
): {
  push: (frame: T) => void;
  reset: () => void;
} {
  let lastEmitAt = -Infinity;
  let pending: T | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = () => {
    if (timer == null) return;
    clock.clearTimeout(timer);
    timer = null;
  };

  const flushPending = () => {
    timer = null;
    if (pending == null) return;
    const frame = pending;
    pending = null;
    lastEmitAt = clock.now();
    emit(frame);
  };

  return {
    push(frame: T) {
      const now = clock.now();
      const elapsed = now - lastEmitAt;
      if (elapsed >= intervalMs) {
        clearTimer();
        pending = null;
        lastEmitAt = now;
        emit(frame);
        return;
      }
      pending = frame;
      if (timer == null) {
        timer = clock.setTimeout(
          flushPending,
          Math.max(0, intervalMs - elapsed),
        );
      }
    },
    reset() {
      clearTimer();
      pending = null;
      lastEmitAt = -Infinity;
    },
  };
}
