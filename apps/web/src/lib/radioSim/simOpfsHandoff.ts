/**
 * EdgeTX WasmRunner.initFs(radioKey) uses an exclusive OPFS SyncAccessHandle.
 * The editor can mount two RadioSimPreview instances (inline canvas + Run in
 * simulator modal). If the next instance boots before the previous worker's
 * terminate() releases that handle, initFs fails, the worker aborts, and
 * auto-recover thrash-reboots for a few seconds until one side wins.
 *
 * Caller must unmount/dispose the other preview first, then wait this long
 * before mounting the next WasmRunner on the same radioKey.
 */
export const SIM_OPFS_HANDOFF_MS = 75;

/** True when the modal should own the only live radio sim runtime. */
export function shouldMountInlineRadioSim(options: {
  inlineSimEnabled: boolean;
  simModalOpen: boolean;
  /** False while waiting for the modal worker to release OPFS after close. */
  inlineRuntimeReady?: boolean;
  hasColorWasm: boolean;
}): boolean {
  return (
    options.inlineSimEnabled &&
    !options.simModalOpen &&
    options.inlineRuntimeReady !== false &&
    options.hasColorWasm
  );
}
