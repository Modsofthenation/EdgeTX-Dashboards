import type { TelemetryProtocol } from "@widget-gen/shared";

export const PROTOCOL_BADGE_LABELS: Record<TelemetryProtocol, string> = {
  betaflight: "Betaflight",
  rotorflight: "Rotorflight",
  "generic-crsf": "CRSF",
};

export function protocolBadgeClass(protocol: TelemetryProtocol): string {
  switch (protocol) {
    case "betaflight":
      return "protocolBetaflight";
    case "rotorflight":
      return "protocolRotorflight";
    case "generic-crsf":
      return "protocolGenericCrsf";
  }
}
