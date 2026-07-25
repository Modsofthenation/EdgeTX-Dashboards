/**
 * Static install guide for the web UI (InstallGuidePanel).
 *
 * This is generic TX15 + protocol copy for onboarding in the browser. Per-widget
 * INSTALL.md inside the downloaded zip is generated from templates/INSTALL.md.tpl
 * at package time and may include widget-specific paths and companion scripts.
 */
import type { TelemetryProtocol } from "@widget-gen/shared";

export interface InstallStep {
  id: string;
  title: string;
  detail: string;
  verify?: string;
}

export interface InstallGuide {
  protocol: TelemetryProtocol;
  protocolLabel: string;
  radioName: string;
  widgetName?: string;
  prerequisites: string[];
  steps: InstallStep[];
  verification: InstallStep[];
  troubleshooting: { issue: string; fix: string }[];
}

const BASE_STEPS: InstallStep[] = [
  {
    id: "copy",
    title: "Copy widget to SD card",
    detail:
      "Extract the downloaded zip and copy WIDGETS/<name>/ to your radio SD card. The file must be at SD:/WIDGETS/<name>/main.lua — folder name must match the widget name field (max 10 characters).",
    verify:
      "On the radio, browse SD card and confirm main.lua exists under WIDGETS/<name>/.",
  },
  {
    id: "discover",
    title: "Discover telemetry sensors",
    detail:
      "Power on receiver and flight controller. Open Model → Telemetry → Discover new. Wait until sensors populate before adding the widget.",
    verify:
      "Telemetry page lists sensors like RxBt, RQLY, Alt (names vary by protocol). Values update live.",
  },
  {
    id: "add-widget",
    title: "Add widget to main view",
    detail:
      "Press TELE, open Setup widgets, tap an empty zone, and select your widget. Configure options if offered.",
    verify: "Widget appears in the widget picker by its 10-character name.",
  },
  {
    id: "fullscreen",
    title: "Enter full-screen mode",
    detail:
      "Long-press the widget zone → Full screen. On TX15 you can also double-tap. Dashboards are designed for full-screen (480×320).",
    verify: "Widget fills the entire screen. Exit with long-press RTN/Back.",
  },
];

const PROTOCOL_NOTES: Record<
  TelemetryProtocol,
  { label: string; prerequisites: string[]; extra?: InstallStep[] }
> = {
  betaflight: {
    label: "Betaflight (CRSF/ELRS)",
    prerequisites: [
      "Betaflight FC with CRSF or ELRS receiver bound and connected",
      "Telemetry enabled in Betaflight (ports tab / receiver protocol)",
      "EdgeTX 2.11+ recommended on TX15",
    ],
    extra: [
      {
        id: "bf-sensors",
        title: "Confirm Betaflight sensor count",
        detail:
          "With GPS enabled, expect ~17 CRSF sensors after Discover new. Restart the radio once if all values show zero after first install.",
        verify:
          "RxBt, Curr, RQLY, and FM sensors show non-zero values when armed or connected.",
      },
    ],
  },
  rotorflight: {
    label: "Rotorflight (CRSF/ELRS)",
    prerequisites: [
      "Rotorflight FC with CRSF/ELRS receiver",
      "rf2bg.lua in SCRIPTS/FUNCTIONS/ (from rotorflight-lua-scripts repo)",
      "Special Function: Run rf2bg, Repeat On",
    ],
    extra: [
      {
        id: "rf2bg",
        title: "Enable rf2bg background script",
        detail:
          "Copy rf2bg.lua to SCRIPTS/FUNCTIONS/. Create a Special Function that runs rf2bg with Repeat set to On. This enables custom CRSF telemetry sensors.",
        verify:
          "After power-on, custom sensors (RPM, HSpd, etc.) appear after Discover new.",
      },
      {
        id: "rf-rediscover",
        title: "Rediscover sensors in correct order",
        detail:
          "Switch off FC and RX. Delete all telemetry sensors. Select Discover new, then power on FC. Wait for all sensors.",
        verify:
          "Rotorflight-specific sensors match those referenced in the widget source.",
      },
    ],
  },
  "generic-crsf": {
    label: "Generic CRSF / ELRS",
    prerequisites: [
      "CRSF or ELRS receiver linked to flight controller",
      "Telemetry stream active (receiver LED / ELRS Lua shows link)",
    ],
    extra: [
      {
        id: "generic-names",
        title: "Verify sensor names on radio",
        detail:
          "Sensor names vary by firmware. Compare discovered names on the Telemetry page with those used in the widget (getSourceIndex calls). Rename sensors in EdgeTX if needed.",
        verify:
          "Each sensor referenced in the widget appears on the Telemetry page.",
      },
    ],
  },
};

const VERIFICATION: InstallStep[] = [
  {
    id: "v-layout",
    title: "Layout fits TX15 screen",
    detail:
      "Open full-screen mode. No text or gauges should be clipped at edges.",
    verify: "All labels readable on 480×320 display.",
  },
  {
    id: "v-telem",
    title: "Telemetry values update",
    detail:
      "Move sticks, change altitude, or throttle — displayed values should change (not stay at zero).",
    verify: "At least battery and link sensors update in real time.",
  },
  {
    id: "v-restart",
    title: "Survives radio restart",
    detail:
      "Power cycle the radio. Widget should still appear and telemetry should resume after link reconnects.",
    verify: "Widget loads automatically on the configured main view.",
  },
];

const TROUBLESHOOTING = [
  {
    issue: "Widget not in picker",
    fix: "Folder name must match widget name (≤10 chars). Reboot radio after copying files.",
  },
  {
    issue: "All values zero",
    fix: "Run Discover new with FC powered. Restart radio. Check receiver bind and telemetry wiring.",
  },
  {
    issue: "Layout clipped",
    fix: "Use full-screen mode. Widget targets 480×320 (TX15).",
  },
  {
    issue: "Missing Rotorflight sensors",
    fix: "Enable rf2bg special function, delete sensors, rediscover with FC on.",
  },
  {
    issue: "Preview differs from radio",
    fix: "Web preview uses mock telemetry; actual colors/layout may vary slightly on hardware.",
  },
];

export function buildInstallGuide(
  protocol: TelemetryProtocol,
  widgetName?: string,
): InstallGuide {
  const proto = PROTOCOL_NOTES[protocol];
  const steps = [...BASE_STEPS];
  if (proto.extra) {
    steps.splice(2, 0, ...proto.extra);
  }

  return {
    protocol,
    protocolLabel: proto.label,
    radioName: "RadioMaster TX15",
    widgetName,
    prerequisites: proto.prerequisites,
    steps,
    verification: VERIFICATION,
    troubleshooting: TROUBLESHOOTING,
  };
}
