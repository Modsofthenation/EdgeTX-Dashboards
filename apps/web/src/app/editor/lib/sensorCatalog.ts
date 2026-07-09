/** Common CRSF sensors by protocol for editor telemetry binding. */
export interface SensorOption {
  label: string;
  formatHint: "raw" | "percent" | "float1" | "float1_amps" | "string";
}

export const SENSOR_CATALOG: Record<string, SensorOption[]> = {
  betaflight: [
    { label: "RxBt", formatHint: "float1" },
    { label: "Curr", formatHint: "float1_amps" },
    { label: "Capa", formatHint: "raw" },
    { label: "Bat%", formatHint: "percent" },
    { label: "RQLY", formatHint: "percent" },
    { label: "TQLY", formatHint: "percent" },
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
    { label: "RxBt", formatHint: "float1" },
    { label: "Curr", formatHint: "float1_amps" },
    { label: "Capa", formatHint: "raw" },
    { label: "Bat%", formatHint: "percent" },
    { label: "RQLY", formatHint: "percent" },
    { label: "HSpd", formatHint: "raw" },
    { label: "RPM", formatHint: "raw" },
    { label: "EscT", formatHint: "raw" },
    { label: "MotT", formatHint: "raw" },
    { label: "FM", formatHint: "string" },
    { label: "Ptch", formatHint: "float1" },
    { label: "Roll", formatHint: "float1" },
  ],
  "generic-crsf": [
    { label: "RxBt", formatHint: "float1" },
    { label: "Curr", formatHint: "float1_amps" },
    { label: "Capa", formatHint: "raw" },
    { label: "Bat%", formatHint: "percent" },
    { label: "RQLY", formatHint: "percent" },
    { label: "TQLY", formatHint: "percent" },
    { label: "1RSS", formatHint: "raw" },
    { label: "2RSS", formatHint: "raw" },
    { label: "Alt", formatHint: "raw" },
    { label: "GSpd", formatHint: "raw" },
    { label: "Sats", formatHint: "raw" },
    { label: "FM", formatHint: "string" },
  ],
};
