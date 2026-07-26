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
  | "flight-logger"
  | "batt-select"
  | "flights-count"
  | "batt-voice"
  | "motor-gate";

export interface CompanionSuite {
  id: CompanionSuiteId;
  label: string;
  shortLabel: string;
  description: string;
  /** Workspace-relative paths under generated/<Name>/ */
  files: { relPath: string; content: string }[];
}

const FLIGHT_LOG = `--- EdgeTX telemetry companion: log arm sessions + bump GV1 flight count
local function appendLine(path, line)
  local f = io.open(path, "a")
  if f then
    f:write(line)
    f:write("\\n")
    f:close()
  end
end

local lastArmed = false
local armMs = 0

local function run(event)
  local thr = getValue("Thr") or 0
  local sa = getValue("SA") or 0
  local armed = thr > 0 or sa > 512
  if armed and not lastArmed then
    armMs = getTime()
    local info = model.getInfo()
    local name = (info and info.name) or "model"
    local path = "/LOGS/" .. name .. "_flights.log"
    local rxbt = getValue("RxBt") or 0
    local curr = getValue("Curr") or 0
    local hspd = getValue("HSpd") or getValue("Hspd") or 0
    local t = getDateTime()
    local stamp = string.format("%04d-%02d-%02d %02d:%02d", t.year, t.mon, t.day, t.hour, t.min)
    appendLine(path, stamp .. ",RxBt=" .. rxbt .. ",Curr=" .. curr .. ",HSpd=" .. hspd .. ",arm")
    local count = model.getGlobalVariable(1, 0) or 0
    model.setGlobalVariable(1, 0, count + 1)
  elseif not armed and lastArmed then
    local info = model.getInfo()
    local name = (info and info.name) or "model"
    local path = "/LOGS/" .. name .. "_flights.log"
    local dur = math.floor((getTime() - armMs) / 100)
    local t = getDateTime()
    local stamp = string.format("%04d-%02d-%02d %02d:%02d", t.year, t.mon, t.day, t.hour, t.min)
    appendLine(path, stamp .. ",duration_s=" .. dur .. ",disarm")
  end
  lastArmed = armed
  return 0
end

return { run = run }
`;

const LOG_VIEW = `--- EdgeTX tool: browse /LOGS/*_flights.log tail
local offset = 0
local lines = {}
local loaded = false

local function loadTail()
  lines = {}
  local info = model.getInfo()
  local name = (info and info.name) or "model"
  local path = "/LOGS/" .. name .. "_flights.log"
  local f = io.open(path, "r")
  if not f then
    lines[1] = "(no log yet — arm once with flight_log)"
    loaded = true
    return
  end
  for line in f:lines() do
    lines[#lines + 1] = line
  end
  f:close()
  if #lines == 0 then
    lines[1] = "(empty log)"
  end
  loaded = true
end

local function run(event)
  if not loaded then loadTail() end
  lcd.clear()
  lcd.drawText(2, 2, "Log view", MIDSIZE)
  local start = math.max(1, #lines - 6 - offset)
  local y = 24
  for i = start, math.min(#lines, start + 6) do
    lcd.drawText(2, y, string.sub(lines[i] or "", 1, 40), SMLSIZE)
    y = y + 12
  end
  lcd.drawText(2, LCD_H - 14, "ROTARY scroll · ENTER reload · EXIT", SMLSIZE)
  if event == EVT_ROT_LEFT then
    offset = math.min(offset + 1, math.max(0, #lines - 1))
  elseif event == EVT_ROT_RIGHT then
    offset = math.max(0, offset - 1)
  elseif event == EVT_ENTER_BREAK then
    loaded = false
  elseif event == EVT_EXIT_BREAK then
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

const FLT_COUNT = `--- EdgeTX tool: show / bump flight count (GV1) — model panel reads GV1
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

const BATT_VOICE = `--- EdgeTX telemetry companion: low-pack voice (playFile) when RxBt drops
-- Place WAV files under SOUNDS/en/ (or your language) e.g. lowbat.wav
local lastWarn = 0
local THRESH_V = 14.0

local function run(event)
  local rxbt = getValue("RxBt") or getValue("Vbat") or 0
  local now = getTime()
  if rxbt > 0 and rxbt < THRESH_V and (now - lastWarn) > 500 then
    playFile("/SOUNDS/en/lowbat.wav")
    lastWarn = now
  end
  return 0
end

return { run = run }
`;

const MOTOR_GATE = `--- EdgeTX tool: set motor-switch gate GV2 (dashboard can hide AMPS when off)
-- GV2 = 0 gated off, 1 motors enabled. Bind a logical switch or use ENTER.
local function run(event)
  local gate = model.getGlobalVariable(2, 0) or 0
  lcd.clear()
  lcd.drawText(2, 2, "Motor gate", MIDSIZE)
  lcd.drawText(2, 36, gate > 0 and "MOTORS ON" or "GATED OFF", DBLSIZE)
  lcd.drawText(2, 80, "ENTER toggle · EXIT leave", SMLSIZE)
  if event == EVT_ENTER_BREAK then
    model.setGlobalVariable(2, 0, gate > 0 and 0 or 1)
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
      "telemetry/flight_log.lua + tools/log_view.lua (logs + bumps GV1 flights)",
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
      "tools/flt_count.lua → SCRIPTS/TOOLS (GV1; model panel footer)",
    files: [{ relPath: "tools/flt_count.lua", content: FLT_COUNT }],
  },
  {
    id: "batt-voice",
    label: "Battery low voice",
    shortLabel: "BV",
    description:
      "telemetry/batt_voice.lua — playFile lowbat when RxBt below threshold",
    files: [{ relPath: "telemetry/batt_voice.lua", content: BATT_VOICE }],
  },
  {
    id: "motor-gate",
    label: "Motor switch gate",
    shortLabel: "MG",
    description:
      "tools/motor_gate.lua — GV2 on/off for motor-tile gating in the dashboard",
    files: [{ relPath: "tools/motor_gate.lua", content: MOTOR_GATE }],
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

/** Build an IMAGES/ SD entry from uploaded PNG bytes (base64). */
export function modelPngToSdFile(
  bytes: Uint8Array,
  fileName = "simmodel.png",
): CompanionSdFile {
  const safe = fileName.replace(/[^\w.-]+/g, "_").slice(0, 12);
  const name = safe.toLowerCase().endsWith(".png") ? safe : `${safe}.png`;
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return {
    path: `IMAGES/${name}`,
    content: btoa(binary),
    encoding: "base64",
  };
}
