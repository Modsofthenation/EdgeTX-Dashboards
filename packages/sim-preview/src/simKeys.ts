import type { SimInputMessage } from "./types.ts";

/** EdgeTX event key ids (see @edgetx/simulator-ui KEY_* map). */
export const EDGETX_KEY_EXIT = 1;

/** Press + release a radio key in one shot (dismiss menus, RTN, etc.). */
export function pulseSimKey(
  send: (msg: SimInputMessage) => void,
  key: number,
): void {
  send({ type: "simKey", key, state: 1 });
  send({ type: "simKey", key, state: 0 });
}

export function pulseSimKeyExit(send: (msg: SimInputMessage) => void): void {
  pulseSimKey(send, EDGETX_KEY_EXIT);
}
