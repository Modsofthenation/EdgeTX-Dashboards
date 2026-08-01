import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateWidgetLua } from "./validate.ts";
import { setActiveLayoutArchetype } from "./variationContext.ts";

const HERO_MINIMAL_SOURCE = [
  "---@type WidgetScript",
  "---@simulate Layout1x1 zone=0",
  'local name = "HeroTest"',
  "local function create(zone, opts) return { zone = zone, options = opts } end",
  "local function refresh(widget, event, touchState)",
  "  lcd.clear(BLACK)",
  "  lcd.drawText(10, 20, 'BATT', SMLSIZE + GREY)",
  "  lcd.drawText(10, 40, '16.2', DBLSIZE + YELLOW)",
  "  lcd.drawText(10, 80, '93%', SMLSIZE + GREEN)",
  "end",
  "return { name = name, create = create, refresh = refresh }",
].join("\n");

const STRIP_SOURCE = [
  "---@type WidgetScript",
  "---@simulate Layout1x1 zone=0",
  'local name = "StripTest"',
  "local function create(zone, opts) return { zone = zone, options = opts } end",
  "local function refresh(widget, event, touchState)",
  "  lcd.clear(BLACK)",
  "  lcd.drawFilledRectangle(0, 0, 100, 300, DARKGREY)",
  "  lcd.drawFilledRectangle(110, 0, 100, 300, DARKGREY)",
  "  lcd.drawText(10, 10, 'A', SMLSIZE + GREY)",
  "  lcd.drawText(120, 10, 'B', SMLSIZE + GREY)",
  "end",
  "return { name = name, create = create, refresh = refresh }",
].join("\n");

const BARE_SOURCE = [
  "---@type WidgetScript",
  "---@simulate Layout1x1 zone=0",
  'local name = "BareTest"',
  "local function create(zone, opts) return { zone = zone, options = opts } end",
  "local function refresh(widget, event, touchState)",
  "  lcd.clear(BLACK)",
  "  lcd.drawText(10, 10, 'A', SMLSIZE + WHITE)",
  "  lcd.drawText(10, 30, 'B', SMLSIZE + WHITE)",
  "end",
  "return { name = name, create = create, refresh = refresh }",
].join("\n");

describe("archetype-aware validateVisualDesign", () => {
  it("hero-minimal without panels does not warn about missing cards", () => {
    setActiveLayoutArchetype("hero-minimal");
    const result = validateWidgetLua(HERO_MINIMAL_SOURCE, {
      layoutArchetype: "hero-minimal",
    });
    const panelWarn = result.issues.find((i) =>
      /grouped regions|card panels/i.test(i.message),
    );
    assert.equal(panelWarn, undefined);
  });

  it("strip-board with two bands passes band rule", () => {
    setActiveLayoutArchetype("strip-board");
    const result = validateWidgetLua(STRIP_SOURCE, {
      layoutArchetype: "strip-board",
    });
    const bandWarn = result.issues.find((i) => /bands/i.test(i.message));
    assert.equal(bandWarn, undefined);
  });

  it("card-grid without panels warns", () => {
    setActiveLayoutArchetype("card-grid");
    const result = validateWidgetLua(BARE_SOURCE, {
      layoutArchetype: "card-grid",
    });
    const panelWarn = result.issues.find((i) =>
      /grouped regions/i.test(i.message),
    );
    assert.ok(panelWarn);
  });
});

describe("validateReturnTable", () => {
  it("accepts a single-line return { name, create, refresh }", () => {
    const source = [
      "---@type WidgetScript",
      "---@simulate Layout1x1 zone=0",
      'local name = "OneLine"',
      "local function create(zone, opts) return { zone = zone, options = opts } end",
      "local function refresh(widget)",
      "  lcd.clear(BLACK)",
      '  lcd.drawText(10, 10, "OK", SMLSIZE + WHITE)',
      "end",
      "return { name = name, create = create, refresh = refresh }",
    ].join("\n");
    const result = validateWidgetLua(source);
    const returnIssues = result.issues.filter((i) =>
      /Return table must include/i.test(i.message),
    );
    assert.equal(returnIssues.length, 0);
    assert.equal(result.valid, true);
  });

  it("accepts a multi-line return table", () => {
    const source = [
      "---@type WidgetScript",
      "---@simulate Layout1x1 zone=0",
      'local name = "MultiLn"',
      "local function create(zone, opts) return { zone = zone, options = opts } end",
      "local function refresh(widget)",
      "  lcd.clear(BLACK)",
      '  lcd.drawText(10, 10, "OK", SMLSIZE + WHITE)',
      "end",
      "return {",
      "  name = name,",
      "  create = create,",
      "  refresh = refresh,",
      "}",
    ].join("\n");
    const result = validateWidgetLua(source);
    const returnIssues = result.issues.filter((i) =>
      /Return table must include/i.test(i.message),
    );
    assert.equal(returnIssues.length, 0);
    assert.equal(result.valid, true);
  });
});

describe("validateNoWidgetNameChrome", () => {
  it("errors when the widget display name is drawn on screen", () => {
    const source = [
      "---@type WidgetScript",
      "---@simulate Layout1x1 zone=0",
      'local name = "BfGPSBatbi"',
      "local function create(zone, opts) return { zone = zone, options = opts } end",
      "local function refresh(widget)",
      "  lcd.clear(BLACK)",
      '  lcd.drawText(10, 12, "BfGPSBatbi", MIDSIZE + WHITE)',
      '  lcd.drawText(10, 40, "16.2", DBLSIZE + YELLOW)',
      "end",
      "return { name = name, create = create, refresh = refresh }",
    ].join("\n");
    const result = validateWidgetLua(source);
    const issue = result.issues.find((i) => /widget name/i.test(i.message));
    assert.ok(issue);
    assert.equal(issue!.severity, "error");
  });
});
