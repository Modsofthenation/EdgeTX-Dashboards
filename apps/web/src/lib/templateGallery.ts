/** Template gallery entries for chat empty-state quick-start. */

import type { TelemetryProtocol } from "@widget-gen/shared";

export interface TemplateGalleryItem {
  id: string;
  title: string;
  prompt: string;
  archetype: string;
  /** Telemetry catalog applied when the template is selected. */
  protocol: TelemetryProtocol;
  /** Optional visual/variant tag shown in the gallery. */
  variant?: string;
}

export const TEMPLATE_GALLERY: TemplateGalleryItem[] = [
  {
    id: "minimal-quad",
    title: "Minimal quad",
    prompt: "Minimal quad dashboard: large timer, battery bar, and RSSI strip",
    archetype: "hero-minimal",
    protocol: "betaflight",
    variant: "freestyle",
  },
  {
    id: "heli-electric",
    title: "RF heli (electric)",
    prompt:
      "StacyDash-style Rotorflight TX15 electric board using prefab sections: top bar + link, model panel, governor, headspeed hero, motor tiles (AMPS/CELL/BEC/ESC), and battery % bar. Call out rf2bg telemetry requirements.",
    archetype: "heli-rotorflight",
    protocol: "rotorflight",
    variant: "electric",
  },
  {
    id: "heli-nitro",
    title: "RF heli (nitro)",
    prompt:
      "Rotorflight nitro heli TX15 dashboard: top bar with RQLY, model panel, governor, headspeed hero (NR/HSpd), RX pack voltage bar instead of AMPS/ESC tiles, call out rf2bg and nitro sensor contract.",
    archetype: "heli-rotorflight",
    protocol: "rotorflight",
    variant: "nitro",
  },
  {
    id: "dense-crsf",
    title: "Dense CRSF grid",
    prompt: "Dense CRSF telemetry grid with link, GPS, and attitude",
    archetype: "telemetry-dense",
    protocol: "generic-crsf",
  },
  {
    id: "whoop",
    title: "Tiny whoop overview",
    prompt:
      "Tiny whoop quad overview: armed banner, link/battery bars, voltage gauge, pitch/roll and capacity cards",
    archetype: "quad-overview",
    protocol: "betaflight",
    variant: "whoop",
  },
  {
    id: "freestyle-quad",
    title: "Freestyle quad",
    prompt:
      "Freestyle Betaflight TX15 board: large timer hero, pack voltage + current strip, RQLY/RSSI, armed indicator, GPS optional row — not a whoop layout.",
    archetype: "quad-overview",
    protocol: "betaflight",
    variant: "freestyle",
  },
  {
    id: "battery-tool",
    title: "Battery + pack tool",
    prompt: "Battery dashboard plus a TOOLS script to select 4S/6S pack",
    archetype: "battery-tool-suite",
    protocol: "betaflight",
  },
  {
    id: "flight-logger",
    title: "Flight logger suite",
    prompt:
      "Flight logger telemetry script with last-flight summary on the dashboard",
    archetype: "flight-logger-suite",
    protocol: "betaflight",
  },
];
