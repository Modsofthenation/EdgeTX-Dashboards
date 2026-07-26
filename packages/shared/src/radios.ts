/** Default target radio for new chats and generation. */
export const DEFAULT_RADIO_ID = "tx15";

/** Layout profile keys shipped in packages/shared/src/layouts/*.json */
export const LAYOUT_PROFILE_IDS = [
  "tx15",
  "color272",
  "taranis212",
  "compact128",
  "nv14",
] as const;
export type LayoutProfileId = (typeof LAYOUT_PROFILE_IDS)[number];

export function isLayoutProfileId(value: string): value is LayoutProfileId {
  return (LAYOUT_PROFILE_IDS as readonly string[]).includes(value);
}
