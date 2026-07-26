/** Common CRSF sensors by protocol for editor telemetry binding. */
export interface SensorOption {
  label: string;
  formatHint: "raw" | "percent" | "float1" | "float1_amps" | "string";
  /** Alternate names discovered on radios / rf2bg. */
  aliases?: string[];
  /** Short note shown in the picker (e.g. Discover new). */
  hint?: string;
}

export const SENSOR_CATALOG: Record<string, SensorOption[]> = {
  betaflight: [
    { label: "RxBt", formatHint: "float1" },
    { label: "Curr", formatHint: "float1_amps" },
    { label: "Capa", formatHint: "raw" },
    { label: "Bat%", formatHint: "percent" },
    {
      label: "RQLY",
      formatHint: "percent",
      aliases: ["RQly", "LQ"],
      hint: "Link quality",
    },
    { label: "TQLY", formatHint: "percent", aliases: ["TQly"] },
    { label: "1RSS", formatHint: "raw" },
    { label: "2RSS", formatHint: "raw" },
    { label: "Alt", formatHint: "raw" },
    { label: "GSpd", formatHint: "raw" },
    { label: "Sats", formatHint: "raw" },
    { label: "FM", formatHint: "string" },
    { label: "Ptch", formatHint: "float1" },
    { label: "Roll", formatHint: "float1" },
    { label: "Yaw", formatHint: "float1" },
  ],
  rotorflight: [
    { label: "RxBt", formatHint: "float1", hint: "Receiver / pack volts" },
    {
      label: "Vbat",
      formatHint: "float1",
      hint: "rf2bg custom CRSF — Discover new",
    },
    {
      label: "Vcel",
      formatHint: "float1",
      hint: "rf2bg per-cell — Discover new",
    },
    {
      label: "Vbec",
      formatHint: "float1",
      hint: "rf2bg BEC — Discover new",
    },
    { label: "Curr", formatHint: "float1_amps" },
    { label: "Capa", formatHint: "raw" },
    { label: "Bat%", formatHint: "percent" },
    {
      label: "RQLY",
      formatHint: "percent",
      aliases: ["RQly", "LQ"],
      hint: "Link quality",
    },
    { label: "1RSS", formatHint: "raw" },
    {
      label: "HSpd",
      formatHint: "raw",
      aliases: ["Hspd"],
      hint: "Headspeed — rf2bg Discover new",
    },
    {
      label: "Tspd",
      formatHint: "raw",
      hint: "Tail RPM — rf2bg Discover new",
    },
    { label: "RPM", formatHint: "raw", aliases: ["Mot rpm"] },
    {
      label: "EscT",
      formatHint: "raw",
      aliases: ["Tesc"],
      hint: "ESC temp — rf2bg Discover new",
    },
    { label: "MotT", formatHint: "raw" },
    { label: "FM", formatHint: "string" },
    {
      label: "Gov",
      formatHint: "raw",
      hint: "Governor enum — rf2bg Discover new",
    },
    { label: "Cel#", formatHint: "raw" },
    { label: "BAT#", formatHint: "raw" },
  ],
  "generic-crsf": [
    { label: "RxBt", formatHint: "float1" },
    { label: "Curr", formatHint: "float1_amps" },
    { label: "Capa", formatHint: "raw" },
    { label: "Bat%", formatHint: "percent" },
    {
      label: "RQLY",
      formatHint: "percent",
      aliases: ["RQly", "LQ"],
    },
    { label: "TQLY", formatHint: "percent", aliases: ["TQly"] },
    { label: "1RSS", formatHint: "raw" },
    { label: "2RSS", formatHint: "raw" },
    { label: "Alt", formatHint: "raw" },
    { label: "GSpd", formatHint: "raw" },
    { label: "Sats", formatHint: "raw" },
    { label: "FM", formatHint: "string" },
  ],
};

export function formatSensorOptionLabel(sensor: SensorOption): string {
  const alias =
    sensor.aliases && sensor.aliases.length > 0
      ? ` · aka ${sensor.aliases.join(", ")}`
      : "";
  const hint = sensor.hint ? ` — ${sensor.hint}` : "";
  return `${sensor.label}${alias}${hint}`;
}
