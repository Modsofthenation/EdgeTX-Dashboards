import {
  EDITOR_PREVIEW_SCENARIO,
  parseLuaToDrawCommands,
  type DrawRecord,
  type EdgeColor,
  type LayoutScenario,
  type MockTelemetry,
} from "@widget-gen/layout-verify";
import {
  extractRefreshBody,
  findRefreshBodyEndIndex,
  findRefreshBodyStartLine,
} from "@widget-gen/shared";
import { STARTER_WIDGET_SOURCE } from "./starterSource.js";

export interface DocumentRecord extends DrawRecord {
  id: string;
}

export interface ZoneOffset {
  zoneX: number;
  zoneY: number;
  zoneW: number;
  zoneH: number;
}

export { STARTER_WIDGET_SOURCE };

export function createStarterSource(): string {
  return STARTER_WIDGET_SOURCE;
}

export function interpretDocument(
  source: string,
  mockOrScenario: MockTelemetry | LayoutScenario = EDITOR_PREVIEW_SCENARIO
): DocumentRecord[] {
  const records = parseLuaToDrawCommands(source, mockOrScenario);
  return records
    .filter((r) => r.kind !== "clear" && r.sourceRef)
    .map((r) => ({ ...r, id: `L${r.sourceLine ?? 0}` }));
}

export function getSourceLine(source: string, lineNum: number): string {
  const lines = source.split("\n");
  return (lines[lineNum - 1] ?? "").replace(/\r$/, "");
}

export function replaceSourceLine(source: string, lineNum: number, newLine: string): string {
  const lines = source.split("\n");
  if (lineNum < 1 || lineNum > lines.length) return source;
  const hadCr = lines[lineNum - 1]!.endsWith("\r");
  lines[lineNum - 1] = hadCr ? `${newLine}\r` : newLine;
  return lines.join("\n");
}

export function patchArgSpan(line: string, span: { start: number; end: number }, newText: string): string {
  return line.slice(0, span.start) + newText + line.slice(span.end);
}

type ArgPatch = Record<string, string | number>;

function lcdToSourceX(lcdX: number, zone: ZoneOffset): string {
  return String(Math.round(lcdX - zone.zoneX));
}

function lcdToSourceY(lcdY: number, zone: ZoneOffset): string {
  return String(Math.round(lcdY - zone.zoneY));
}

function formatTextLiteral(text: string): string {
  return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function argMapForRecord(record: DrawRecord): Record<string, number> {
  switch (record.kind) {
    case "text":
      return { x: 0, y: 1, text: 2, flags: 3 };
    case "filledRect":
    case "rect":
      return { x: 0, y: 1, w: 2, h: 3, color: 4 };
    case "line":
      return { x: 0, y: 1, x2: 2, y2: 3, color: record.sourceRef?.args.length === 6 ? 5 : 4 };
    case "gauge":
      return { x: 0, y: 1, w: 2, h: 3, fill: 4, maxFill: 5, color: 6 };
    case "circle":
    case "filledCircle":
      return { x: 0, y: 1, r: 2, color: 3 };
    case "arc":
      return { x: 0, y: 1, r: 2, startAngle: 3, endAngle: 4, color: 5 };
    case "annulus":
      return { x: 0, y: 1, rIn: 2, rOut: 3, startAngle: 4, endAngle: 5, color: 7 };
    case "bitmap":
      return { x: 1, y: 2 };
    default:
      return {};
  }
}

function formatPatchValue(key: string, value: string | number, record: DrawRecord): string {
  if (key === "text" && typeof value === "string") return formatTextLiteral(value);
  if (key === "flags" && typeof value === "string") return value;
  if (key === "color" && typeof value === "string") return value;
  return String(Math.round(Number(value)));
}

/** Patch numeric/text args on the anchored source line. LCD coords for x/y are converted to zone-relative. */
export function patchRecordArgs(
  source: string,
  record: DrawRecord,
  patch: ArgPatch,
  zone: ZoneOffset
): string {
  const ref = record.sourceRef;
  if (!ref) return source;

  let line = getSourceLine(source, ref.sourceLine);
  const map = argMapForRecord(record);

  for (const [key, value] of Object.entries(patch)) {
    const argIdx = map[key];
    if (argIdx === undefined) continue;
    const span = ref.args[argIdx];
    if (!span) continue;

    let text: string;
    if (key === "x") text = lcdToSourceX(Number(value), zone);
    else if (key === "y") text = lcdToSourceY(Number(value), zone);
    else if (key === "x2") text = lcdToSourceX(Number(value), zone);
    else if (key === "y2") text = lcdToSourceY(Number(value), zone);
    else text = formatPatchValue(key, value, record);

    line = patchArgSpan(line, span, text);
  }

  return replaceSourceLine(source, ref.sourceLine, line);
}

export function translateRecord(
  source: string,
  record: DrawRecord,
  dx: number,
  dy: number,
  zone: ZoneOffset
): string {
  const patch: ArgPatch = {};
  if (record.x != null) patch.x = record.x + dx;
  if (record.y != null) patch.y = record.y + dy;
  if (record.kind === "line") {
    if (record.x2 != null) patch.x2 = record.x2 + dx;
    if (record.y2 != null) patch.y2 = record.y2 + dy;
  }
  return patchRecordArgs(source, record, patch, zone);
}

export function resizeRecord(
  source: string,
  record: DrawRecord,
  box: { x: number; y: number; w: number; h: number },
  zone: ZoneOffset
): string {
  return patchRecordArgs(
    source,
    record,
    {
      x: box.x + zone.zoneX,
      y: box.y + zone.zoneY,
      w: box.w,
      h: box.h,
    },
    zone
  );
}

export function setRecordColor(
  source: string,
  record: DrawRecord,
  color: EdgeColor,
  zone: ZoneOffset
): string {
  if (record.kind === "text") {
    const flags = record.fontSize && record.fontSize >= 20 ? "DBLSIZE" : record.fontSize && record.fontSize >= 14 ? "MIDSIZE" : "SMLSIZE";
    return patchRecordArgs(source, record, { flags: `${flags} + ${color}` }, zone);
  }
  return patchRecordArgs(source, record, { color }, zone);
}

export function setRecordText(
  source: string,
  record: DrawRecord,
  text: string,
  zone: ZoneOffset
): string {
  return patchRecordArgs(source, record, { text }, zone);
}

export function removeRecordLine(source: string, record: DrawRecord): string {
  const lineNum = record.sourceRef?.sourceLine ?? record.sourceLine;
  if (!lineNum) return source;
  const lines = source.split("\n");
  if (lineNum < 1 || lineNum > lines.length) return source;
  lines.splice(lineNum - 1, 1);
  return lines.join("\n");
}

export const INSERT_LINE_TEMPLATES: Record<string, string> = {
  text: 'lcd.drawText(12, 12, "Text", SMLSIZE + WHITE)',
  filledRect: "lcd.drawFilledRectangle(12, 48, 80, 40, DARKGREY)",
  rect: "lcd.drawRectangle(12, 48, 80, 40, GREY)",
  line: "lcd.drawLine(12, 12, 100, 100, SOLID, WHITE)",
  gauge: "lcd.drawGauge(12, 48, 40, 80, 50, 100, CYAN)",
  circle: "lcd.drawCircle(60, 60, 24, WHITE)",
  filledCircle: "lcd.drawFilledCircle(60, 60, 24, GREEN)",
  arc: "lcd.drawArc(120, 80, 40, 0, 270, CYAN)",
  annulus: "lcd.drawAnnulus(120, 80, 30, 40, 0, 270, CYAN)",
  bitmap: "lcd.drawBitmap(widget.modelBmp, 12, 48)",
};

export function insertDrawLine(source: string, kind: keyof typeof INSERT_LINE_TEMPLATES): string {
  const template = INSERT_LINE_TEMPLATES[kind];
  if (!template) return source;
  const bodyEnd = findRefreshBodyEndIndex(source);
  const indent = "  ";
  const line = `${indent}${template}`;
  return source.slice(0, bodyEnd) + "\n" + line + source.slice(bodyEnd);
}

export function patchWidgetName(source: string, name: string): string {
  const trimmed = name.slice(0, 10);
  if (/local\s+name\s*=/.test(source)) {
    return source.replace(/local\s+name\s*=\s*"[^"]*"/, `local name = "${trimmed}"`);
  }
  return source;
}

export function parseDocumentMeta(source: string) {
  const nameMatch = source.match(/local\s+name\s*=\s*"([^"]+)"/);
  const simMatch = source.match(/@simulate\s+(\S+)\s+zone=(\d+)/);
  return {
    name: nameMatch?.[1]?.slice(0, 10) ?? "Widget",
    layout: simMatch?.[1] ?? "Layout1x1",
    zone: Number(simMatch?.[2] ?? 0),
    refreshBody: extractRefreshBody(source),
    refreshStartLine: findRefreshBodyStartLine(source),
  };
}
