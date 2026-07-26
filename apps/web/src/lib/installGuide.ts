/**
 * Static install guide for the web UI (InstallGuidePanel).
 *
 * Per-widget INSTALL.md inside the downloaded zip is generated from
 * templates/INSTALL.md.tpl at package time and may include widget-specific
 * paths and companion scripts.
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
  lcdW: number;
  lcdH: number;
  touch: boolean;
  widgetName?: string;
  prerequisites: string[];
  steps: InstallStep[];
  verification: InstallStep[];
  troubleshooting: { issue: string; fix: string }[];
}

export type BuildInstallGuideOptions = {
  radioName?: string;
  lcdW?: number;
  lcdH?: number;
  touch?: boolean;
};

function baseSteps(opts: {
  radioName: string;
  lcdW: number;
  lcdH: number;
  touch: boolean;
}): InstallStep[] {
  const fullscreenDetail = opts.touch
    ? `Long-press the widget zone → Full screen. On touch radios (${opts.radioName}) you can also double-tap. Dashboards target full-screen (${opts.lcdW}×${opts.lcdH}).`
    : `Long-press the widget zone → Full screen. Dashboards target full-screen (${opts.lcdW}×${opts.lcdH}).`;

  return [
    {
      id: "copy",
      title: "Copy widget to SD card",
      detail:
        "Extract the downloaded zip and copy WIDGETS/<name>/ to your radio SD card. Also copy SCRIPTS/ and IMAGES/ entries when present — folder name must match the widget name field (max 10 characters).",
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
      detail: fullscreenDetail,
      verify: "Widget fills the entire screen. Exit with long-press RTN/Back.",
    },
  ];
}

const PROTOCOL_NOTES: Record<
  TelemetryProtocol,
  { label: string; prerequisites: string[]; extra?: InstallStep[] }
> = {
  betaflight: {
    label: "Betaflight (CRSF/ELRS)",
    prerequisites: [
      "Betaflight FC with CRSF or ELRS receiver bound and connected",
      "Telemetry enabled in Betaflight (ports tab / receiver protocol)",
      "EdgeTX 2.10+ recommended (2.11+ for latest color radios)",
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

function verificationSteps(lcdW: number, lcdH: number): InstallStep[] {
  return [
    {
      id: "v-layout",
      title: "Layout fits the radio screen",
      detail: `Open full-screen mode. No text or gauges should be clipped at edges (${lcdW}×${lcdH}).`,
      verify: `All labels readable on ${lcdW}×${lcdH} display.`,
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
}

function troubleshooting(lcdW: number, lcdH: number, radioName: string) {
  return [
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
      fix: `Use full-screen mode. Widget targets ${lcdW}×${lcdH} (${radioName}).`,
    },
    {
      issue: "Missing Rotorflight sensors",
      fix: "Enable rf2bg special function, delete sensors, rediscover with FC on.",
    },
    {
      issue: "Preview differs from radio",
      fix: "Web preview uses mock telemetry; actual colors/layout may vary slightly on hardware. Full WASM sim is TX15 firmware today — other radios use dimension-correct parser preview.",
    },
  ];
}

export function buildInstallGuide(
  protocol: TelemetryProtocol,
  widgetName?: string,
  radioNameOrOpts?: string | BuildInstallGuideOptions,
): InstallGuide {
  const opts: BuildInstallGuideOptions =
    typeof radioNameOrOpts === "string"
      ? { radioName: radioNameOrOpts }
      : (radioNameOrOpts ?? {});
  const radioName = opts.radioName?.trim() || "RadioMaster TX15";
  const lcdW = opts.lcdW ?? 480;
  const lcdH = opts.lcdH ?? 320;
  const touch = opts.touch ?? true;

  const proto = PROTOCOL_NOTES[protocol];
  const steps = [...baseSteps({ radioName, lcdW, lcdH, touch })];
  if (proto.extra) {
    steps.splice(2, 0, ...proto.extra);
  }

  return {
    protocol,
    protocolLabel: proto.label,
    radioName,
    lcdW,
    lcdH,
    touch,
    widgetName,
    prerequisites: proto.prerequisites,
    steps,
    verification: verificationSteps(lcdW, lcdH),
    troubleshooting: troubleshooting(lcdW, lcdH, radioName),
  };
}

/** Markdown suitable for INSTALL.md when copying to SD via the desktop wizard. */
export function formatInstallGuideMarkdown(guide: InstallGuide): string {
  const name = guide.widgetName ?? "Widget";
  const lines: string[] = [
    `# Install ${name} on ${guide.radioName}`,
    "",
    `Protocol: **${guide.protocolLabel}** · Display: **${guide.lcdW}×${guide.lcdH}**`,
    "",
    "## Prerequisites",
    "",
    ...guide.prerequisites.map((p) => `- ${p}`),
    "",
    "## Setup steps",
    "",
  ];
  for (const [i, step] of guide.steps.entries()) {
    lines.push(`### ${i + 1}. ${step.title}`, "", step.detail, "");
    if (step.verify) lines.push(`Ensure: ${step.verify}`, "");
  }
  lines.push("## Verification", "");
  for (const step of guide.verification) {
    lines.push(`- **${step.title}** — ${step.detail}`);
  }
  lines.push("", "## Troubleshooting", "");
  for (const row of guide.troubleshooting) {
    lines.push(`- **${row.issue}:** ${row.fix}`);
  }
  lines.push("");
  return lines.join("\n");
}
