import type { TextFormat } from "./types.js";
import { getSourceLine, replaceSourceLine, type DocumentRecord } from "./luaDocument.js";

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
};

export function sensorKeyForLabel(sensor: string): string {
  return (
    SENSOR_TO_KEY[sensor] ??
    sensor.toLowerCase().replace(/%/g, "p").replace(/[^a-z0-9]/gi, "")
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
  if (sensor === "RQLY" || sensor === "TQLY" || sensor === "Bat%") return "percent";
  if (sensor === "Curr") return "float1_amps";
  if (sensor === "RxBt") return "float1";
  if (sensor === "FM") return "string";
  return "raw";
}

/**
 * Ensure create() caches the sensor and refresh() has a local value, then rewrite
 * the selected drawText third argument to a formatted telemetry expression.
 */
export function bindTextRecordToSensor(
  source: string,
  record: DocumentRecord,
  sensor: string,
  format?: TextFormat
): string {
  if (record.kind !== "text" || !record.sourceRef) return source;
  const key = sensorKeyForLabel(sensor);
  const fmt = format ?? defaultFormatForSensor(sensor);
  const localVar = `v_${key}`;

  // Patch drawText first so sourceLine anchors stay valid, then inject cache/locals.
  const lineNum = record.sourceRef.sourceLine;
  const line = getSourceLine(source, lineNum);
  const drawMatch = line.match(/lcd\.drawText\s*\(/);
  if (!drawMatch || drawMatch.index === undefined) return source;
  const argsStart = drawMatch.index + drawMatch[0].length;
  const args = splitTopLevelArgs(line.slice(argsStart));
  if (args.length < 3) return source;
  const third = args[2]!;
  const expr = formatExpr(localVar, fmt);
  const patchedLine =
    line.slice(0, argsStart + third.start) + expr + line.slice(argsStart + third.end);
  let next = replaceSourceLine(source, lineNum, patchedLine);

  next = ensureTelemetryCache(next, key, sensor);
  next = ensureRefreshLocal(next, key, localVar);
  return next;
}

function hasSensorCache(source: string, key: string, sensor: string): boolean {
  if (new RegExp(`\\b${escapeReg(key)}\\s*=\\s*cacheSource\\s*\\(\\s*"${escapeReg(sensor)}"`).test(source)) {
    return true;
  }
  if (new RegExp(`\\b${escapeReg(key)}\\s*=\\s*getSourceIndex\\s*\\(\\s*"${escapeReg(sensor)}"`).test(source)) {
    return true;
  }
  return false;
}

function ensureTelemetryCache(source: string, key: string, sensor: string): string {
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

  const createMatch = source.match(/local\s+function\s+create\s*\([^)]*\)/);
  if (!createMatch || createMatch.index === undefined) return source;
  const insertAt = createMatch.index + createMatch[0].length;
  const snippet = `\n  -- telemetry: ${sensor}\n  -- (add src.${key} = cacheSource("${sensor}") in create)\n`;
  return source.slice(0, insertAt) + snippet + source.slice(insertAt);
}

function ensureRefreshLocal(source: string, key: string, localVar: string): string {
  if (new RegExp(`local\\s+${escapeReg(localVar)}\\s*=`).test(source)) return source;
  const refreshMatch = source.match(
    /(?:local\s+function\s+refresh\s*\([^)]*\)|refresh\s*=\s*function\s*\([^)]*\))/
  );
  if (!refreshMatch || refreshMatch.index === undefined) return source;
  const insertAt = refreshMatch.index + refreshMatch[0].length;
  // Prefer telem() helper when present; else getValue(widget.src.key).
  const usesTelem = /\bfunction\s+telem\s*\(/.test(source) || /\btelem\s*=\s*function/.test(source);
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

function splitTopLevelArgs(argsSrc: string): { start: number; end: number; text: string }[] {
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
