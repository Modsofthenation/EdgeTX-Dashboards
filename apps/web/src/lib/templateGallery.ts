/** Template gallery entries for chat empty-state quick-start. */
export interface TemplateGalleryItem {
  id: string;
  title: string;
  prompt: string;
  archetype: string;
}

export const TEMPLATE_GALLERY: TemplateGalleryItem[] = [
  {
    id: "minimal-quad",
    title: "Minimal quad",
    prompt: "Minimal quad dashboard: large timer, battery bar, and RSSI strip",
    archetype: "hero-minimal",
  },
  {
    id: "heli",
    title: "Rotorflight heli",
    prompt: "Rotorflight heli board with headspeed hero and motor temps",
    archetype: "heli-rotorflight",
  },
  {
    id: "dense-crsf",
    title: "Dense CRSF grid",
    prompt: "Dense CRSF telemetry grid with link, GPS, and attitude",
    archetype: "telemetry-dense",
  },
  {
    id: "whoop",
    title: "Tiny whoop overview",
    prompt:
      "Tiny whoop quad overview: armed banner, link/battery bars, voltage gauge, pitch/roll and capacity cards",
    archetype: "quad-overview",
  },
  {
    id: "battery-tool",
    title: "Battery + pack tool",
    prompt: "Battery dashboard plus a TOOLS script to select 4S/6S pack",
    archetype: "battery-tool-suite",
  },
  {
    id: "flight-logger",
    title: "Flight logger suite",
    prompt: "Flight logger telemetry script with last-flight summary on the dashboard",
    archetype: "flight-logger-suite",
  },
];
