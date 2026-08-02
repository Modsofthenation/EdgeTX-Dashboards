import type { SimInputMessage } from "./types.ts";

/** EdgeTX event key ids (see @edgetx/simulator-ui KEY_* map). */
export const EDGETX_KEY_EXIT = 1;

/**
 * Hold duration so firmware can scan the key before release.
 * Matches @edgetx/simulator-ui Escape handling (80ms).
 */
export const SIM_KEY_PULSE_MS = 80;

/** Press + release a radio key (dismiss menus, RTN, etc.). */
export function pulseSimKey(
  send: (msg: SimInputMessage) => void,
  key: number,
  holdMs: number = SIM_KEY_PULSE_MS,
): void {
  send({ type: "simKey", key, state: 1 });
  if (holdMs <= 0) {
    send({ type: "simKey", key, state: 0 });
    return;
  }
  setTimeout(() => {
    send({ type: "simKey", key, state: 0 });
  }, holdMs);
}

export function pulseSimKeyExit(
  send: (msg: SimInputMessage) => void,
  holdMs: number = SIM_KEY_PULSE_MS,
): void {
  pulseSimKey(send, EDGETX_KEY_EXIT, holdMs);
}
