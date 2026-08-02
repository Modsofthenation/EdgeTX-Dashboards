import type { TextFormat } from "./types.ts";
import {
  getSourceLine,
  replaceSourceLine,
  type DocumentRecord,
} from "./luaDocument.ts";

const SENSOR_TO_KEY: Record<string, string> = {
  RQLY: "rqly",
  TQLY: "tqly",
  "1RSS": "rss1",
  "2RSS": "rss2",
  RxBt: "rxbt",
  Curr: "curr",
  Capa: "capa",
  "Bat%": "batp",
  Alt: "alt",
  GSpd: "gspd",
  Sats: "sats",
  FM: "fm",
  Ptch: "ptch",
  Roll: "roll",
  Yaw: "yaw",
  HSpd: "hspd",
  RPM: "rpm",
  EscT: "esct",
  MotT: "mott",
  Tspd: "tspd",
  Vbec: "vbec",
  Vcel: "vcel",
  Vbat: "vbat",
  Gov: "gov",
  "Cel#": "celn",
  "BAT#": "batn",
};

export function sensorKeyForLabel(sensor: string): string {
  return (
    SENSOR_TO_KEY[sensor] ??
    sensor
      .toLowerCase()
      .replace(/%/g, "p")
      .replace(/[^a-z0-9]/gi, "")
  );
}

function formatExpr(localVar: string, format: TextFormat): string {
  switch (format) {
    case "percent":
      return `tostring(${localVar}) .. "%"`;
    case "float1":
      return `string.format("%.1f", ${localVar})`;
    case "float1_amps":
      return `string.format("%.1f A", ${localVar})`;
    case "string":
      return localVar;
    case "raw":
    default:
      return `tostring(${localVar})`;
  }
}

function defaultFormatForSensor(sensor: string): TextFormat {
  if (sensor === "RQLY" || sensor === "TQLY" || sensor === "Bat%")
    return "percent";
  if (sensor === "Curr") return "float1_amps";
  if (sensor === "RxBt") return "float1";
  if (sensor === "FM") return "string";
  return "raw";
}

export interface BindTelemetryResult {
  source: string;
  /** Line-id of the bound drawText after cache/local inserts (`L{n}`), if found. */
  recordId: string | null;
}

/**
 * Ensure create() caches the sensor and refresh() has a local value, then rewrite
 * the selected drawText third argument to a formatted telemetry expression.
 */
export function bindTextRecordToSensor(
  source: string,
  record: DocumentRecord,
  sensor: string,
  format?: TextFormat,
): string {
  return bindTextRecordToSensorDetailed(source, record, sensor, format).source;
}

export function bindTextRecordToSensorDetailed(
  source: string,
  record: DocumentRecord,
  sensor: string,
  format?: TextFormat,
): BindTelemetryResult {
  if (record.kind !== "text" || !record.sourceRef) {
    return { source, recordId: record.id ?? null };
  }
  const key = sensorKeyForLabel(sensor);
  const fmt = format ?? defaultFormatForSensor(sensor);
  const localVar = `v_${key}`;

  // Patch drawText first so sourceLine anchors stay valid, then inject cache/locals.
  const lineNum = record.sourceRef.sourceLine;
  const line = getSourceLine(source, lineNum);
  const drawMatch = line.match(/lcd\.drawText\s*\(/);
  if (!drawMatch || drawMatch.index === undefined) {
    return { source, recordId: record.id ?? null };
  }
  const argsStart = drawMatch.index + drawMatch[0].length;
  const args = splitTopLevelArgs(line.slice(argsStart));
  if (args.length < 3) return { source, recordId: record.id ?? null };
  const third = args[2]!;
  const expr = formatExpr(localVar, fmt);
  const patchedLine =
    line.slice(0, argsStart + third.start) +
    expr +
    line.slice(argsStart + third.end);
  let next = replaceSourceLine(source, lineNum, patchedLine);

  next = ensureTelemetryCache(next, key, sensor);
  next = ensureRefreshLocal(next, key, localVar);

  const recordId = findDrawTextRecordId(next, expr);
  return { source: next, recordId };
}

/** Locate the drawText line whose third arg matches `expr` after binding inserts. */
export function findDrawTextRecordId(
  source: string,
  expr: string,
): string | null {
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const drawMatch = line.match(/lcd\.drawText\s*\(/);
    if (!drawMatch || drawMatch.index === undefined) continue;
    const argsStart = drawMatch.index + drawMatch[0].length;
    const args = splitTopLevelArgs(line.slice(argsStart));
    if (args.length >= 3 && args[2]!.text === expr) return `L${i + 1}`;
  }
  return null;
}

function hasSensorCache(source: string, key: string, sensor: string): boolean {
  if (
    new RegExp(
      `\\b${escapeReg(key)}\\s*=\\s*cacheSource\\s*\\(\\s*"${escapeReg(sensor)}"`,
    ).test(source)
  ) {
    return true;
  }
  if (
    new RegExp(
      `\\b${escapeReg(key)}\\s*=\\s*getSourceIndex\\s*\\(\\s*"${escapeReg(sensor)}"`,
    ).test(source)
  ) {
    return true;
  }
  return false;
}

function ensureTelemetryCache(
  source: string,
  key: string,
  sensor: string,
): string {
  if (hasSensorCache(source, key, sensor)) return source;

  // Prefer inserting into an existing `src = { ... }` table in create().
  const srcTable = source.match(/\bsrc\s*=\s*\{/);
  if (srcTable && srcTable.index !== undefined) {
    const open = srcTable.index + srcTable[0].length;
    const close = findMatchingBrace(source, open - 1);
    if (close > open) {
      const insert = `\n      ${key} = cacheSource("${sensor}"),`;
      return source.slice(0, close) + insert + source.slice(close);
    }
  }

  // No src = { ... } table — inject a minimal create() cache assignment before return.
  const createReturn = source.match(
    /local\s+function\s+create\s*\([^)]*\)[\s\S]*?\breturn\s*\{/,
  );
  if (createReturn && createReturn.index !== undefined) {
    const insertAt = createReturn.index + createReturn[0].length;
    const snippet = `\n    src = { ${key} = cacheSource("${sensor}") },`;
    // If return already has fields, prefer a preceding local assignment instead.
    const after = source.slice(insertAt, insertAt + 80);
    if (/\bsrc\s*=/.test(after)) return source;
    return source.slice(0, insertAt) + snippet + source.slice(insertAt);
  }

  const createMatch = source.match(/local\s+function\s+create\s*\([^)]*\)/);
  if (!createMatch || createMatch.index === undefined) return source;
  const bodyStart = createMatch.index + createMatch[0].length;
  const snippet = `\n  local ${key} = cacheSource("${sensor}")\n`;
  return source.slice(0, bodyStart) + snippet + source.slice(bodyStart);
}

function ensureRefreshLocal(
  source: string,
  key: string,
  localVar: string,
): string {
  if (new RegExp(`local\\s+${escapeReg(localVar)}\\s*=`).test(source))
    return source;
  const refreshMatch = source.match(
    /(?:local\s+function\s+refresh\s*\([^)]*\)|refresh\s*=\s*function\s*\([^)]*\))/,
  );
  if (!refreshMatch || refreshMatch.index === undefined) return source;
  const insertAt = refreshMatch.index + refreshMatch[0].length;
  // Prefer telem() helper when present; else getValue(widget.src.key).
  const usesTelem =
    /\bfunction\s+telem\s*\(/.test(source) ||
    /\btelem\s*=\s*function/.test(source);
  const valueExpr = usesTelem
    ? `telem(widget.src.${key})`
    : `getValue(widget.src.${key}) or 0`;
  const snippet = `\n  local ${localVar} = ${valueExpr}`;
  return source.slice(0, insertAt) + snippet + source.slice(insertAt);
}

function findMatchingBrace(source: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    } else if (ch === '"' || ch === "'") {
      i++;
      while (i < source.length && source[i] !== ch) {
        if (source[i] === "\\") i++;
        i++;
      }
    } else if (ch === "-" && source[i + 1] === "-") {
      const nl = source.indexOf("\n", i);
      i = nl === -1 ? source.length : nl;
    }
  }
  return -1;
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const CREATE_SIG = /local\s+function\s+create\s*\([^)]*\)/;
const LUA_BLOCK_OPEN = new Set(["function", "if", "for", "while", "repeat"]);

/** create() body range, or null when the widget has no create(). */
function findCreateBodyRange(
  source: string,
): { start: number; end: number } | null {
  const sig = source.match(CREATE_SIG);
  if (!sig || sig.index === undefined) return null;
  const start = sig.index + sig[0].length;
  const end = findBalancedLuaEnd(source, start);
  return { start, end };
}

/**
 * Prefer create() for src cache reads/writes. Fall back to the full source when
 * create() is missing (fragment fixtures / incomplete imports).
 */
function createScopedSlice(source: string): { text: string; offset: number } {
  const range = findCreateBodyRange(source);
  if (!range) return { text: source, offset: 0 };
  return { text: source.slice(range.start, range.end), offset: range.start };
}

function findBalancedLuaEnd(source: string, bodyStart: number): number {
  let depth = 1;
  let i = bodyStart;
  while (i < source.length && depth > 0) {
    const ch = source[i];
    if (ch === "-" && source[i + 1] === "-") {
      const nl = source.indexOf("\n", i);
      i = nl === -1 ? source.length : nl + 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === "\\") i++;
        i++;
      }
      i++;
      continue;
    }
    const word = source.slice(i).match(/^[A-Za-z_]\w*/);
    if (word) {
      if (LUA_BLOCK_OPEN.has(word[0]!)) depth++;
      else if (word[0] === "end" || word[0] === "until") depth--;
      i += word[0]!.length;
      continue;
    }
    i++;
  }
  return depth === 0 ? i - 3 : source.length;
}

/**
 * Remap an existing `src` cache key to a different catalog sensor name.
 * Keeps the Lua field (`widget.src.hspd`) stable so prefab refresh locals keep working.
 * Only rewrites assignments inside create() when that function is present.
 */
export function remapSrcSensor(
  source: string,
  key: string,
  newSensor: string,
): string {
  if (!key || !newSensor) return source;
  const { text, offset } = createScopedSlice(source);
  const keyRe = escapeReg(key);
  const patterns = [
    new RegExp(`(\\b${keyRe}\\s*=\\s*cacheSource\\s*\\(\\s*")([^"]*)(")`),
    new RegExp(`(\\b${keyRe}\\s*=\\s*getSourceIndex\\s*\\(\\s*")([^"]*)(")`),
  ];
  for (const re of patterns) {
    if (re.test(text)) {
      const next = text.replace(re, `$1${newSensor}$3`);
      return (
        source.slice(0, offset) + next + source.slice(offset + text.length)
      );
    }
  }
  return source;
}

/** Read current create() src key → sensor pairs (cacheSource or getSourceIndex). */
export function listSrcBindings(
  source: string,
): { key: string; sensor: string }[] {
  const { text } = createScopedSlice(source);
  const bindings: { key: string; sensor: string }[] = [];
  const seen = new Set<string>();
  const re =
    /\b(\w+)\s*=\s*(?:cacheSource|getSourceIndex)\s*\(\s*"([^"]+)"\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const key = match[1]!;
    if (seen.has(key)) continue;
    seen.add(key);
    bindings.push({ key, sensor: match[2]! });
  }
  return bindings;
}

export type DetectedTextBinding = {
  key: string;
  sensor: string;
  format: TextFormat;
};

/** Infer telemetry binding from a drawText third argument, if present. */
export function detectTextBinding(
  source: string,
  record: DocumentRecord,
): DetectedTextBinding | null {
  if (record.kind !== "text") return null;
  const lineNum = record.sourceRef?.sourceLine ?? record.sourceLine;
  if (!lineNum) return null;
  const line = getSourceLine(source, lineNum);
  const call = line.match(/lcd\.drawText\s*\((.*)$/);
  if (!call) return null;
  const args = splitTopLevelArgs(call[1] ?? "");
  const textArg = args[2]?.text?.trim() ?? "";
  if (!textArg || (textArg.startsWith('"') && textArg.endsWith('"'))) {
    return null;
  }

  const bindings = listSrcBindings(source);
  const byKey = new Map(bindings.map((b) => [b.key, b.sensor]));

  let key: string | null = null;
  let format: TextFormat = "raw";

  let m = textArg.match(/^tostring\s*\(\s*v_(\w+)\s*\)\s*\.\.\s*"%"$/);
  if (m) {
    key = m[1]!;
    format = "percent";
  } else if (
    (m = textArg.match(/^string\.format\s*\(\s*"%.1f A"\s*,\s*v_(\w+)\s*\)$/))
  ) {
    key = m[1]!;
    format = "float1_amps";
  } else if (
    (m = textArg.match(/^string\.format\s*\(\s*"%.1f"\s*,\s*v_(\w+)\s*\)$/))
  ) {
    key = m[1]!;
    format = "float1";
  } else if ((m = textArg.match(/^tostring\s*\(\s*v_(\w+)\s*\)$/))) {
    key = m[1]!;
    format = "raw";
  } else if ((m = textArg.match(/^v_(\w+)$/))) {
    key = m[1]!;
    format = "string";
  }

  if (!key) return null;
  const sensor = byKey.get(key);
  if (!sensor) return null;
  return { key, sensor, format };
}

function splitTopLevelArgs(
  argsSrc: string,
): { start: number; end: number; text: string }[] {
  const args: { start: number; end: number; text: string }[] = [];
  let depth = 0;
  let start = 0;
  let i = 0;
  while (i < argsSrc.length) {
    const ch = argsSrc[i]!;
    if (ch === "(" || ch === "{" || ch === "[") depth++;
    else if (ch === ")" || ch === "}" || ch === "]") {
      if (depth === 0 && ch === ")") {
        args.push({ start, end: i, text: argsSrc.slice(start, i).trim() });
        break;
      }
      depth--;
    } else if (ch === '"' || ch === "'") {
      i++;
      while (i < argsSrc.length && argsSrc[i] !== ch) {
        if (argsSrc[i] === "\\") i++;
        i++;
      }
    } else if (ch === "," && depth === 0) {
      args.push({ start, end: i, text: argsSrc.slice(start, i).trim() });
      start = i + 1;
    }
    i++;
  }
  return args;
}
