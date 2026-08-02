/**
 * Mutual exclusion between the WASM frame tick and virtual-SD writes.
 *
 * EdgeTX reads widget body/gen from FAT during refresh(). Concurrent
 * `fsWriteFile` from the JS side can tear those reads and abort the worker.
 * Single-threaded JS makes the lock reliable as long as we never await
 * between the busy-check and the flag flip.
 */

export type FsTickGate = {
  /** Wait until no tick is in flight, then block new ticks. */
  beginFsExclusive: () => Promise<void>;
  endFsExclusive: () => void;
  /** True when a deploy holds the gate (runLoop should await). */
  fsGate: () => Promise<void> | null;
  /** Mark the start of a WASM frame tick. Returns false if FS holds the gate. */
  tryBeginTick: () => boolean;
  endTick: () => void;
  /** Test helper / diagnostics. */
  isTickBusy: () => boolean;
  reset: () => void;
};

export function createFsTickGate(): FsTickGate {
  let tickBusy = false;
  let gate: Promise<void> | null = null;
  let releaseGate: (() => void) | null = null;

  const waitWhileTickBusy = async () => {
    for (;;) {
      if (!tickBusy) return;
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  };

  return {
    async beginFsExclusive() {
      await waitWhileTickBusy();
      if (!gate) {
        gate = new Promise<void>((resolve) => {
          releaseGate = resolve;
        });
      }
      // A tick cannot have started without an await — we are still sync since
      // waitWhileTickBusy returned — but re-check after nested waiters.
      await waitWhileTickBusy();
    },
    endFsExclusive() {
      const release = releaseGate;
      gate = null;
      releaseGate = null;
      release?.();
    },
    fsGate: () => gate,
    tryBeginTick() {
      if (gate) return false;
      tickBusy = true;
      return true;
    },
    endTick() {
      tickBusy = false;
    },
    isTickBusy: () => tickBusy,
    reset() {
      tickBusy = false;
      const release = releaseGate;
      gate = null;
      releaseGate = null;
      release?.();
    },
  };
}
