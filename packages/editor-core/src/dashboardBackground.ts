/**
 * Detect and rewrite the dashboard full-board background:
 * solid color (lcd.clear), EdgeTX model bitmap, or a custom /IMAGES PNG.
 */
import {
  extractRefreshBody,
  findRefreshBodyEndIndex,
  findRefreshBodyStartLine,
} from "@widget-gen/shared";
import { RADIO_SAFE_COLOR_NAMES } from "./colors.ts";
import { getSourceLine, replaceSourceLine } from "./luaDocument.ts";

export type DashboardBgMode = "color" | "model" | "image";

export const DEFAULT_BG_IMAGE_PATH = "/IMAGES/dashbg.png";

export type DashboardBackgroundState = {
  mode: DashboardBgMode;
  /** Literal used in lcd.clear(...) when mode is color (e.g. BLACK, bg). */
  clearArg: string;
  /** Safe picker color when clearArg is a known literal. */
  color: string;
  /** Custom image path when mode is image (e.g. /IMAGES/dashbg.png). */
  imagePath: string | null;
};

const SAFE_COLOR_SET = new Set<string>(RADIO_SAFE_COLOR_NAMES);

const BG_DRAW_RE =
  /[ \t]*if\s+widget\.(modelBmp|bgBmp)\s+then\s*\n[ \t]*lcd\.drawBitmap\(\s*widget\.\1\s*,\s*0\s*,\s*0\s*\)\s*\n[ \t]*end\s*\n?/;

const CLEAR_RE = /lcd\.clear\s*\(\s*([^)]+)\s*\)/;

const BG_IMG_RE = /local\s+BG_IMG\s*=\s*"([^"]+)"/;

function findFirstClearLine(source: string): number | null {
  const start = findRefreshBodyStartLine(source);
  const endIdx = findRefreshBodyEndIndex(source);
  if (start < 1 || endIdx < 0) return null;
  const lines = source.split("\n");
  let acc = 0;
  let endLine = lines.length;
  for (let i = 0; i < lines.length; i++) {
    acc += lines[i]!.length + 1;
    if (acc > endIdx) {
      endLine = i;
      break;
    }
  }
  for (let i = start - 1; i < endLine && i < lines.length; i++) {
    if (CLEAR_RE.test(lines[i]!)) return i + 1;
  }
  return null;
}

/** Read BgColor option default when lcd.clear uses `bg` / widget.options.BgColor. */
export function resolveBgColorOption(source: string): string | null {
  const m = source.match(
    /\{\s*"BgColor"\s*,\s*COLOR\s*,\s*([A-Za-z0-9_]+)\s*\}/,
  );
  if (!m) return null;
  const color = m[1]!;
  return SAFE_COLOR_SET.has(color) ? color : null;
}

function resolvePickerColor(clearArg: string, source: string): string {
  if (SAFE_COLOR_SET.has(clearArg)) return clearArg;
  return resolveBgColorOption(source) ?? "BLACK";
}

/** Read current background mode from widget Lua. */
export function detectDashboardBackground(
  source: string,
): DashboardBackgroundState {
  const body = extractRefreshBody(source);
  const clearMatch = body.match(CLEAR_RE);
  const clearArg = (clearMatch?.[1] ?? "BLACK").trim();
  const color = resolvePickerColor(clearArg, source);

  const imagePath = source.match(BG_IMG_RE)?.[1] ?? null;
  const hasModelDraw =
    /if\s+widget\.modelBmp\s+then[\s\S]*?drawBitmap\(\s*widget\.modelBmp\s*,\s*0\s*,\s*0/.test(
      body,
    );
  const hasImageDraw =
    /if\s+widget\.bgBmp\s+then[\s\S]*?drawBitmap\(\s*widget\.bgBmp\s*,\s*0\s*,\s*0/.test(
      body,
    );

  if (hasImageDraw || (imagePath && /widget\.bgBmp/.test(body))) {
    return {
      mode: "image",
      clearArg,
      color,
      imagePath: imagePath ?? DEFAULT_BG_IMAGE_PATH,
    };
  }
  if (hasModelDraw) {
    return { mode: "model", clearArg, color, imagePath: null };
  }
  return { mode: "color", clearArg, color, imagePath: null };
}

function stripFullscreenBgDraw(source: string): string {
  return source.replace(BG_DRAW_RE, "");
}

function setLcdClearArg(source: string, clearArg: string): string {
  const lineNum = findFirstClearLine(source);
  if (lineNum != null) {
    const line = getSourceLine(source, lineNum);
    const nextLine = line.replace(CLEAR_RE, `lcd.clear(${clearArg})`);
    return replaceSourceLine(source, lineNum, nextLine);
  }
  // Insert clear at start of refresh body.
  const start = findRefreshBodyStartLine(source);
  if (start < 1) return source;
  const lines = source.split("\n");
  const indent =
    lines[start - 1]?.match(/^(\s*)/)?.[1] ??
    lines[start]?.match(/^(\s*)/)?.[1] ??
    "  ";
  lines.splice(start - 1, 0, `${indent}lcd.clear(${clearArg})`);
  return lines.join("\n");
}

function injectFullscreenBgDraw(
  source: string,
  field: "modelBmp" | "bgBmp",
): string {
  let next = stripFullscreenBgDraw(source);
  const lineNum = findFirstClearLine(next);
  const block = `  if widget.${field} then\n    lcd.drawBitmap(widget.${field}, 0, 0)\n  end`;
  if (lineNum != null) {
    const lines = next.split("\n");
    lines.splice(lineNum, 0, ...block.split("\n"));
    return lines.join("\n");
  }
  const start = findRefreshBodyStartLine(next);
  if (start < 1) return next;
  const lines = next.split("\n");
  lines.splice(start - 1, 0, "  lcd.clear(BLACK)", ...block.split("\n"));
  return lines.join("\n");
}

function ensureLoadModelBitmap(source: string): string {
  if (/function\s+loadModelBitmap\s*\(/.test(source)) {
    // Still ensure create() returns modelBmp when helper already exists.
    return ensureModelBmpInCreate(source);
  }

  const helper = `local function loadModelBitmap()
  local info = model.getInfo()
  local name = info and info.bitmap or ""
  if name == nil or name == "" then
    return nil, 0, 0
  end
  local bmp = Bitmap.open("/IMAGES/" .. name)
  if bmp == nil then
    return nil, 0, 0
  end
  local w, h = Bitmap.getSize(bmp)
  return bmp, w, h
end
`;

  let next = source;
  const optionsBlock = next.match(/\nlocal\s+options\s*=\s*\{/);
  if (optionsBlock && optionsBlock.index !== undefined) {
    next =
      next.slice(0, optionsBlock.index) +
      "\n" +
      helper +
      next.slice(optionsBlock.index);
  } else {
    next = helper + "\n" + next;
  }

  return ensureModelBmpInCreate(next);
}

function ensureModelBmpInCreate(source: string): string {
  let next = source;
  const createFn = next.match(/local\s+function\s+create\s*\([^)]*\)\s*\n/);
  if (createFn && createFn.index !== undefined) {
    const bodyStart = createFn.index + createFn[0].length;
    if (!/loadModelBitmap\(\)/.test(next.slice(bodyStart, bodyStart + 500))) {
      next =
        next.slice(0, bodyStart) +
        "  local modelBmp, bmpW, bmpH = loadModelBitmap()\n" +
        next.slice(bodyStart);
    }
  }

  const createReturn = next.match(
    /local\s+function\s+create\s*\([^)]*\)[\s\S]*?\breturn\s*\{/,
  );
  if (createReturn && createReturn.index !== undefined) {
    const insertAt = createReturn.index + createReturn[0].length;
    if (!/modelBmp\s*=/.test(next.slice(insertAt, insertAt + 240))) {
      next =
        next.slice(0, insertAt) +
        "\n    modelBmp = modelBmp,\n    bmpW = bmpW,\n    bmpH = bmpH," +
        next.slice(insertAt);
    }
  }

  return next;
}

function ensureBgImage(source: string, imagePath: string): string {
  let next = source;
  if (BG_IMG_RE.test(next)) {
    next = next.replace(BG_IMG_RE, `local BG_IMG = "${imagePath}"`);
  } else {
    const optionsBlock = next.match(/\nlocal\s+options\s*=\s*\{/);
    const insert = `\nlocal BG_IMG = "${imagePath}"\n`;
    if (optionsBlock && optionsBlock.index !== undefined) {
      next =
        next.slice(0, optionsBlock.index) +
        insert +
        next.slice(optionsBlock.index);
    } else {
      next = insert + next;
    }
  }

  const createReturn = next.match(
    /local\s+function\s+create\s*\([^)]*\)[\s\S]*?\breturn\s*\{/,
  );
  if (createReturn && createReturn.index !== undefined) {
    const insertAt = createReturn.index + createReturn[0].length;
    if (!/bgBmp\s*=/.test(next.slice(insertAt, insertAt + 240))) {
      next =
        next.slice(0, insertAt) +
        "\n    bgBmp = Bitmap.open(BG_IMG)," +
        next.slice(insertAt);
    }
  }

  return next;
}

function removeBgImage(source: string): string {
  let next = source.replace(/\n?local\s+BG_IMG\s*=\s*"[^"]*"\s*\n?/, "\n");
  next = next.replace(/\n?\s*bgBmp\s*=\s*Bitmap\.open\([^)]*\),?\s*/g, "\n");
  return next;
}

function patchBgColorOption(source: string, color: string): string {
  if (/\{\s*"BgColor"\s*,\s*COLOR\s*,/.test(source)) {
    return source.replace(
      /(\{\s*"BgColor"\s*,\s*COLOR\s*,\s*)[A-Za-z0-9_]+(\s*\})/,
      `$1${color}$2`,
    );
  }
  return source;
}

export type ApplyDashboardBackgroundInput = {
  mode: DashboardBgMode;
  /** Color literal when mode is color (defaults BLACK). */
  color?: string;
  /** Path for custom image mode (defaults /IMAGES/dashbg.png). */
  imagePath?: string;
};

/** Rewrite widget Lua for the requested background mode. */
export function applyDashboardBackground(
  source: string,
  input: ApplyDashboardBackgroundInput,
): string {
  const color =
    input.color && SAFE_COLOR_SET.has(input.color) ? input.color : "BLACK";
  const imagePath = input.imagePath?.trim() || DEFAULT_BG_IMAGE_PATH;

  let next = stripFullscreenBgDraw(source);

  if (input.mode === "color") {
    next = removeBgImage(next);
    const current = detectDashboardBackground(source);
    const usesBgOption =
      current.clearArg === "bg" ||
      current.clearArg === "widget.options.BgColor" ||
      /BgColor/.test(current.clearArg) ||
      /\bbg\s*=\s*widget\.options\.BgColor/.test(source);

    if (usesBgOption) {
      next = patchBgColorOption(next, color);
      if (/\bbg\s*=\s*widget\.options\.BgColor/.test(next)) {
        next = setLcdClearArg(next, "bg");
      } else {
        next = setLcdClearArg(next, color);
      }
    } else {
      next = setLcdClearArg(next, color);
      next = patchBgColorOption(next, color);
    }
    return next;
  }

  if (input.mode === "model") {
    next = removeBgImage(next);
    next = ensureLoadModelBitmap(next);
    next = setLcdClearArg(next, "BLACK");
    next = injectFullscreenBgDraw(next, "modelBmp");
    return next;
  }

  // custom image
  next = ensureBgImage(next, imagePath);
  next = setLcdClearArg(next, "BLACK");
  next = injectFullscreenBgDraw(next, "bgBmp");
  return next;
}
