import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseLuaToDrawCommands } from "../luaPreviewEngine.js";
import { BASE_MOCK } from "../mockTelemetry.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const heliExample = readFileSync(
  join(__dirname, "../../../../../examples/tx15-rotorflight-heli.lua"),
  "utf8"
);

describe("parseLuaToDrawCommands", () => {
  it("renders heli dashboard cards at distinct Y positions", () => {
    const cmds = parseLuaToDrawCommands(heliExample, BASE_MOCK);
    const fills = cmds.filter((c) => c.kind === "filledRect");
    const texts = cmds.filter((c) => c.kind === "text");

    assert.ok(fills.length >= 5, `expected card rects, got ${fills.length}`);
    const ys = new Set(fills.map((c) => c.y));
    assert.ok(ys.size >= 3, `expected varied Y coords, got ${[...ys].join(",")}`);

    const link = texts.find((t) => t.text === "LINK");
    assert.ok(link && (link.y ?? 0) > 40, "LINK should be below header");

    const bad = texts.find((t) => t.text?.includes(".."));
    assert.equal(bad, undefined, `unresolved concat in preview: ${bad?.text}`);
  });

  it("evaluates tostring() in drawText args", () => {
    const source = [
      "---@simulate Layout1x1 zone=0",
      "local function refresh(widget)",
      "  local adjv = 12",
      "  lcd.drawText(10, 300, tostring(adjv), SMLSIZE + YELLOW)",
      "end",
      "return {}",
    ].join("\n");

    const cmds = parseLuaToDrawCommands(source, BASE_MOCK);
    const text = cmds.find((c) => c.kind === "text");
    assert.equal(text?.text, "12");
  });

  it("evaluates string.format and concat in drawText args", () => {
    const source = [
      "---@simulate Layout1x1 zone=0",
      "local function refresh(widget)",
      "  local pad = 12",
      "  local cardY = 52",
      "  local volts = 16.2",
      "  local motorLine = \"Motor \" .. \"3200\" .. \" ESC \" .. \"42\" .. \"C\"",
      "  lcd.drawText(10, 22, string.format(\"%.1f\", volts), DBLSIZE + YELLOW)",
      "  lcd.drawText(10, 200, motorLine, SMLSIZE + WHITE)",
      "end",
      "return {}",
    ].join("\n");

    const cmds = parseLuaToDrawCommands(source, BASE_MOCK);
    const voltsText = cmds.find((c) => c.kind === "text" && c.text === "16.2");
    const motorText = cmds.find((c) => c.kind === "text" && c.text?.startsWith("Motor "));
    assert.ok(voltsText);
    assert.equal(motorText?.text, "Motor 3200 ESC 42C");
  });
});
