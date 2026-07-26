/**
 * First-class companion script suites for Layout Insert + SD install.
 * Templates follow knowledge/design/companion-scripts.md.
 */

export type CompanionSdFile = {
  /** Relative SD path (WIDGETS/… or SCRIPTS/…) */
  path: string;
  content: string;
  encoding?: "utf8" | "base64";
};

export type CompanionSuiteId =
  "flight-logger" | "batt-select" | "flights-count";

export interface CompanionSuite {
  id: CompanionSuiteId;
  label: string;
  shortLabel: string;
  description: string;
  /** Workspace-relative paths under generated/<Name>/ */
  files: { relPath: string; content: string }[];
}

const FLIGHT_LOG = `--- EdgeTX telemetry companion: append arm sessions to /LOGS/
local function appendLine(path, line)
  local f = io.open(path, "a")
  if f then
    f:write(line)
    f:write("\\n")
    f:close()
  end
end

local lastArmed = false

local function run(event)
  local armed = getValue("Thr") > 0 or getValue("SA") > 0
  if armed and not lastArmed then
    local info = model.getInfo()
    local name = (info and info.name) or "model"
    local path = "/LOGS/" .. name .. "_flights.log"
    local rxbt = getValue("RxBt") or 0
    local curr = getValue("Curr") or 0
    local t = getDateTime()
    local stamp = string.format("%04d-%02d-%02d %02d:%02d", t.year, t.mon, t.day, t.hour, t.min)
    appendLine(path, stamp .. ",RxBt=" .. rxbt .. ",Curr=" .. curr)
  end
  lastArmed = armed
  return 0
end

return { run = run }
`;

const LOG_VIEW = `--- EdgeTX tool: browse recent /LOGS/ lines (simple)
local offset = 0

local function run(event)
  lcd.clear()
  lcd.drawText(2, 2, "Log view", MIDSIZE)
  lcd.drawText(2, 28, "Open /LOGS on SD for CSV.", SMLSIZE)
  lcd.drawText(2, 44, "PAGE/EXIT to leave.", SMLSIZE)
  if event == EVT_EXIT_BREAK then
    return 2
  end
  return 0
end

return { run = run }
`;

const BATT_SELECT = `--- EdgeTX tool: pick pack label / cell count into GV0
local packs = { "4S 1300", "4S 1550", "6S 1300", "6S 1800" }
local idx = 1

local function run(event)
  lcd.clear()
  lcd.drawText(2, 2, "Batt select", MIDSIZE)
  lcd.drawText(2, 32, packs[idx], DBLSIZE)
  lcd.drawText(2, 80, "ROTARY change · ENTER save", SMLSIZE)
  if event == EVT_ROT_LEFT then
    idx = idx > 1 and idx - 1 or #packs
  elseif event == EVT_ROT_RIGHT then
    idx = idx < #packs and idx + 1 or 1
  elseif event == EVT_ENTER_BREAK then
    model.setGlobalVariable(0, 0, idx)
    return 2
  elseif event == EVT_EXIT_BREAK then
    return 2
  end
  return 0
end

return { run = run }
`;

const FLT_COUNT = `--- EdgeTX tool: show / bump flight count (GV1)
local function run(event)
  local count = model.getGlobalVariable(1, 0) or 0
  lcd.clear()
  lcd.drawText(2, 2, "Flights", MIDSIZE)
  lcd.drawText(2, 36, tostring(count), DBLSIZE)
  lcd.drawText(2, 80, "ENTER +1 · EXIT leave", SMLSIZE)
  if event == EVT_ENTER_BREAK then
    model.setGlobalVariable(1, 0, count + 1)
  elseif event == EVT_EXIT_BREAK then
    return 2
  end
  return 0
end

return { run = run }
`;

export const COMPANION_SUITES: CompanionSuite[] = [
  {
    id: "flight-logger",
    label: "Flight logger suite",
    shortLabel: "FL",
    description:
      "telemetry/flight_log.lua + tools/log_view.lua → SCRIPTS/TELEMETRY + TOOLS",
    files: [
      { relPath: "telemetry/flight_log.lua", content: FLIGHT_LOG },
      { relPath: "tools/log_view.lua", content: LOG_VIEW },
    ],
  },
  {
    id: "batt-select",
    label: "Battery selector",
    shortLabel: "BT",
    description: "tools/batt_select.lua → SCRIPTS/TOOLS (pack presets via GV0)",
    files: [{ relPath: "tools/batt_select.lua", content: BATT_SELECT }],
  },
  {
    id: "flights-count",
    label: "Flights counter",
    shortLabel: "FC",
    description:
      "tools/flt_count.lua → SCRIPTS/TOOLS (GV1; pairs with model panel footer)",
    files: [{ relPath: "tools/flt_count.lua", content: FLT_COUNT }],
  },
];

export function getCompanionSuite(
  id: CompanionSuiteId,
): CompanionSuite | undefined {
  return COMPANION_SUITES.find((s) => s.id === id);
}

/** Map workspace-relative companion paths to SD install paths. */
export function companionFilesToSd(
  files: { relPath: string; content: string }[],
): CompanionSdFile[] {
  const out: CompanionSdFile[] = [];
  for (const file of files) {
    const rel = file.relPath.replace(/\\/g, "/");
    if (rel.startsWith("tools/") && rel.endsWith(".lua")) {
      out.push({
        path: `SCRIPTS/TOOLS/${rel.slice("tools/".length)}`,
        content: file.content,
        encoding: "utf8",
      });
    } else if (rel.startsWith("telemetry/") && rel.endsWith(".lua")) {
      out.push({
        path: `SCRIPTS/TELEMETRY/${rel.slice("telemetry/".length)}`,
        content: file.content,
        encoding: "utf8",
      });
    }
  }
  return out;
}

const STORAGE_PREFIX = "edgetx.editorCompanions.";

export type EditorCompanionState = {
  suites: CompanionSuiteId[];
  files: { relPath: string; content: string }[];
};

export function loadEditorCompanions(key: string): EditorCompanionState {
  if (typeof window === "undefined") return { suites: [], files: [] };
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (!raw) return { suites: [], files: [] };
    const parsed = JSON.parse(raw) as EditorCompanionState;
    return {
      suites: Array.isArray(parsed.suites) ? parsed.suites : [],
      files: Array.isArray(parsed.files) ? parsed.files : [],
    };
  } catch {
    return { suites: [], files: [] };
  }
}

export function saveEditorCompanions(
  key: string,
  state: EditorCompanionState,
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(state));
}

/** Merge a suite into existing companion state (idempotent by relPath). */
export function addCompanionSuite(
  state: EditorCompanionState,
  suiteId: CompanionSuiteId,
): EditorCompanionState {
  const suite = getCompanionSuite(suiteId);
  if (!suite) return state;
  const byPath = new Map(state.files.map((f) => [f.relPath, f]));
  for (const file of suite.files) {
    byPath.set(file.relPath, file);
  }
  const suites = state.suites.includes(suiteId)
    ? state.suites
    : [...state.suites, suiteId];
  return { suites, files: [...byPath.values()] };
}
