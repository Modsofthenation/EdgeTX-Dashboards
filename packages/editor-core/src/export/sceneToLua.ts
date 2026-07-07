import type { EdgeColor } from "@widget-gen/layout-verify";
import type {
  EditorElement,
  TextBinding,
  TextElement,
  WidgetScene,
} from "../types.js";
import { hexToEdgeColor } from "../colors.js";

function fontFlagsForElement(el: TextElement): string {
  if (el.fontFlags?.length) return el.fontFlags.join(" + ");
  if (el.fontSize >= 20) return "DBLSIZE";
  if (el.fontSize >= 14) return "MIDSIZE";
  return "SMLSIZE";
}

function edgeColorName(color: string): EdgeColor {
  if (color in { WHITE: 1, BLACK: 1, GREY: 1, GREEN: 1, YELLOW: 1 }) {
    return color as EdgeColor;
  }
  return hexToEdgeColor(color);
}

function emitTextValue(el: TextElement, locals: Set<string>): string {
  if (el.content !== undefined) {
    const escaped = el.content.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${escaped}"`;
  }
  if (!el.binding) return '""';
  const key = el.binding.sensorKey;
  const local = `v_${key}`;
  locals.add(key);
  const base = `tostring(${local})`;
  switch (el.binding.format) {
    case "percent":
      return `${base} .. "%"`;
    case "float1":
      return `string.format("%.1f", ${local})`;
    case "float1_amps":
      return `string.format("%.1f A", ${local})`;
    case "string":
      return local;
    case "raw":
    default:
      if (el.binding.prefix || el.binding.suffix) {
        const parts: string[] = [];
        if (el.binding.prefix) parts.push(`"${el.binding.prefix}"`);
        parts.push(base);
        if (el.binding.suffix) parts.push(`"${el.binding.suffix}"`);
        return parts.join(" .. ");
      }
      return base;
  }
}

function emitElementDraw(el: EditorElement, indent: string, locals: Set<string>): string[] {
  if (!el.visible) return [];
  const lines: string[] = [];
  const color = (c: string) => edgeColorName(c);

  switch (el.kind) {
    case "text": {
      const flags = `${fontFlagsForElement(el)} + ${color(el.color)}`;
      lines.push(
        `${indent}lcd.drawText(${el.x}, ${el.y}, ${emitTextValue(el, locals)}, ${flags})`
      );
      break;
    }
    case "filledRect": {
      if (el.dynamicWidth) {
        const key = el.dynamicWidth.sensorKey;
        locals.add(key);
        lines.push(`${indent}local barW_${key} = ${el.w}`);
        lines.push(
          `${indent}local fillW_${key} = math.floor(barW_${key} * math.max(0, math.min(100, v_${key})) / 100)`
        );
        lines.push(
          `${indent}lcd.drawFilledRectangle(${el.x}, ${el.y}, barW_${key}, ${el.h}, ${color(el.color)})`
        );
        lines.push(`${indent}if fillW_${key} > 0 then`);
        lines.push(
          `${indent}  lcd.drawFilledRectangle(${el.x}, ${el.y}, fillW_${key}, ${el.h}, GREEN)`
        );
        lines.push(`${indent}end`);
      } else {
        lines.push(
          `${indent}lcd.drawFilledRectangle(${el.x}, ${el.y}, ${el.w}, ${el.h}, ${color(el.color)})`
        );
      }
      break;
    }
    case "rect":
      lines.push(
        `${indent}lcd.drawRectangle(${el.x}, ${el.y}, ${el.w}, ${el.h}, ${color(el.color)})`
      );
      break;
    case "line":
      lines.push(
        `${indent}lcd.drawLine(${el.x1}, ${el.y1}, ${el.x2}, ${el.y2}, ${el.pattern ?? "SOLID"}, ${color(el.color)})`
      );
      break;
    case "gauge":
      lines.push(
        `${indent}lcd.drawGauge(${el.x}, ${el.y}, ${el.w}, ${el.h}, ${el.fill}, ${el.maxFill}, ${color(el.color)})`
      );
      break;
    case "circle":
      lines.push(
        `${indent}lcd.drawCircle(${el.x}, ${el.y}, ${el.r}, ${color(el.color)})`
      );
      break;
    case "filledCircle":
      lines.push(
        `${indent}lcd.drawFilledCircle(${el.x}, ${el.y}, ${el.r}, ${color(el.color)})`
      );
      break;
    case "arc":
      lines.push(
        `${indent}lcd.drawArc(${el.x}, ${el.y}, ${el.r}, ${el.startAngle}, ${el.endAngle}, ${color(el.color)})`
      );
      break;
    case "annulus":
      lines.push(
        `${indent}lcd.drawAnnulus(${el.x}, ${el.y}, ${el.rIn}, ${el.rOut}, ${el.startAngle}, ${el.endAngle}, ${color(el.color)})`
      );
      break;
    case "bitmap":
      lines.push(`${indent}if widget.modelBmp then`);
      lines.push(
        `${indent}  lcd.drawBitmap(widget.modelBmp, ${el.x}, ${el.y}${el.scale != null ? `, ${el.scale}` : ""})`
      );
      lines.push(`${indent}end`);
      break;
    default:
      break;
  }
  return lines;
}

function emitTelemetryLocals(keys: Set<string>, indent: string): string[] {
  const lines: string[] = [];
  for (const key of keys) {
    lines.push(`${indent}local v_${key} = telem(widget.src.${key})`);
  }
  return lines;
}

function emitElementGroup(elements: EditorElement[], indent: string): string[] {
  const lines: string[] = [];
  let i = 0;

  while (i < elements.length) {
    const gate = elements[i]?.optionGate;
    if (gate) {
      const group: EditorElement[] = [];
      while (i < elements.length && elements[i]?.optionGate === gate) {
        group.push(elements[i]!);
        i++;
      }
      lines.push(`${indent}if widget.options.${gate} == 1 then`);
      const locals = new Set<string>();
      const drawLines: string[] = [];
      for (const el of group) {
        drawLines.push(...emitElementDraw(el, indent + "  ", locals));
      }
      lines.push(...emitTelemetryLocals(locals, indent + "  "));
      lines.push(...drawLines);
      lines.push(`${indent}end`);
    } else {
      const group: EditorElement[] = [];
      while (i < elements.length && !elements[i]?.optionGate) {
        group.push(elements[i]!);
        i++;
      }
      const locals = new Set<string>();
      const drawLines: string[] = [];
      for (const el of group) {
        drawLines.push(...emitElementDraw(el, indent, locals));
      }
      lines.push(...emitTelemetryLocals(locals, indent));
      lines.push(...drawLines);
    }
  }

  return lines;
}

function emitOptionsTable(scene: WidgetScene): string {
  if (scene.options.length === 0) return "local options = {}";
  const rows = scene.options.map((o) => `  { "${o.name}", BOOL, ${o.defaultValue} },`);
  return `local options = {\n${rows.join("\n")}\n}`;
}

function sceneUsesModelBitmap(scene: WidgetScene): boolean {
  return scene.elements.some((el) => el.visible && el.kind === "bitmap");
}

const MODEL_BITMAP_HELPERS = `local function loadModelBitmap()
  local info = model.getInfo()
  local name = info and info.bitmap or ""
  if name == nil or name == "" then
    return nil
  end
  return Bitmap.open("/IMAGES/" .. name)
end
`;

function emitCreateReturnBody(scene: WidgetScene): string {
  const rows = ["    zone = zone,", "    options = opts,"];
  if (sceneUsesModelBitmap(scene)) {
    rows.push("    modelBmp = loadModelBitmap(),");
  }
  rows.push(emitTelemetryTable(scene));
  return rows.join("\n");
}

function emitTelemetryTable(scene: WidgetScene): string {
  if (scene.telemetry.length === 0) {
    return "    src = {},";
  }
  const rows = scene.telemetry.map(
    (t) => `      ${t.key} = cacheSource("${t.sensor}"),`
  );
  return `    src = {\n${rows.join("\n")}\n    },`;
}

/** Generate a complete EdgeTX widget Lua source from a scene. */
export function sceneToLua(scene: WidgetScene): string {
  const simLine = `---@simulate ${scene.simulate.layout} zone=${scene.simulate.zone}`;
  const refreshBody = emitElementGroup(scene.elements, "  ");
  const bitmapHelpers = sceneUsesModelBitmap(scene) ? `${MODEL_BITMAP_HELPERS}\n` : "";

  return `---@type WidgetScript
${simLine}

local name = "${scene.name}"

${emitOptionsTable(scene)}

${bitmapHelpers}local function cacheSource(sensorName)
  local idx = getSourceIndex(sensorName)
  if idx and idx > 0 then return idx end
  return nil
end

local function telem(id)
  if id then return getValue(id) end
  return 0
end

local function create(zone, opts)
  return {
${emitCreateReturnBody(scene)}
  }
end

local function update(widget, opts)
  widget.options = opts
end

local function refresh(widget, event, touchState)
  local w = LCD_W
  local h = LCD_H

  lcd.clear(BLACK)

${refreshBody.join("\n")}
end

return {
  name = name,
  options = options,
  create = create,
  update = update,
  refresh = refresh,
}
`;
}

/** Create an empty scene with defaults for the TX15 full-screen zone. */
export function createEmptyScene(name = "NewDash"): WidgetScene {
  return {
    name: name.slice(0, 10),
    simulate: { layout: "Layout1x1", zone: 0 },
    options: [],
    telemetry: [],
    elements: [],
  };
}

/** Insert a new element with sensible defaults at canvas center. */
export function createDefaultElement(kind: EditorElement["kind"], id: string): EditorElement {
  const cx = 240;
  const cy = 160;

  switch (kind) {
    case "text":
      return {
        id,
        kind: "text",
        visible: true,
        x: cx - 40,
        y: cy,
        content: "Label",
        fontSize: 12,
        color: "WHITE",
        fontFlags: ["SMLSIZE"],
      };
    case "filledRect":
      return {
        id,
        kind: "filledRect",
        visible: true,
        x: cx - 60,
        y: cy - 40,
        w: 120,
        h: 80,
        color: "#404040",
      };
    case "rect":
      return {
        id,
        kind: "rect",
        visible: true,
        x: cx - 60,
        y: cy - 40,
        w: 120,
        h: 80,
        color: "GREY",
      };
    case "line":
      return {
        id,
        kind: "line",
        visible: true,
        x1: cx - 40,
        y1: cy,
        x2: cx + 40,
        y2: cy,
        color: "WHITE",
        pattern: "SOLID",
      };
    case "gauge":
      return {
        id,
        kind: "gauge",
        visible: true,
        x: cx - 50,
        y: cy - 25,
        w: 100,
        h: 50,
        color: "GREEN",
        fill: 50,
        maxFill: 100,
      };
    case "circle":
      return {
        id,
        kind: "circle",
        visible: true,
        x: cx,
        y: cy,
        r: 40,
        color: "WHITE",
      };
    case "filledCircle":
      return {
        id,
        kind: "filledCircle",
        visible: true,
        x: cx,
        y: cy,
        r: 40,
        color: "CYAN",
      };
    case "arc":
      return {
        id,
        kind: "arc",
        visible: true,
        x: cx,
        y: cy,
        r: 50,
        startAngle: 270,
        endAngle: 360,
        color: "CYAN",
      };
    case "annulus":
      return {
        id,
        kind: "annulus",
        visible: true,
        x: cx,
        y: cy,
        rIn: 30,
        rOut: 50,
        startAngle: 270,
        endAngle: 360,
        color: "CYAN",
      };
    case "bitmap":
      return {
        id,
        kind: "bitmap",
        visible: true,
        x: cx - 28,
        y: cy - 20,
        placeholder: "model",
      };
    default:
      throw new Error(`Unknown element kind: ${kind satisfies never}`);
  }
}

export type { TextBinding };
