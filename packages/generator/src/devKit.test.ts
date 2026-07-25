import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ensureDevKitAnnotations,
  parseSimulateAnnotation,
  parseScriptTypeAnnotation,
  resolvePreviewDimensions,
  TX15_SIMULATE_PROFILE,
  isFullLcdSimulateZone,
} from "@widget-gen/shared";
import {
  validateDevKitAnnotations,
  validateStubApiCalls,
} from "./devKit.ts";
import { validateWidgetLua } from "./validate.ts";
import { getRepoRoot, loadSimulateLayoutProfile } from "./knowledge.ts";

const examplePath = join(getRepoRoot(), "examples", "tx15-minimal-dashboard.lua");
const exampleSource = readFileSync(examplePath, "utf-8");

describe("dev-kit annotations", () => {
  it("parses @type and @simulate from example", () => {
    assert.equal(parseScriptTypeAnnotation(exampleSource), "WidgetScript");
    assert.deepEqual(parseSimulateAnnotation(exampleSource), {
      layout: "Layout1x1",
      zone: 0,
    });
  });

  it("injects missing annotations", () => {
    const bare = 'local name = "Test"\nreturn { name = name, create = function() end, refresh = function() end }';
    const annotated = ensureDevKitAnnotations(bare, TX15_SIMULATE_PROFILE);
    assert.match(annotated, /---@type WidgetScript/);
    assert.match(annotated, /---@simulate Layout1x1 zone=0/);
  });

  it("resolves full-screen preview dimensions", () => {
    const dims = resolvePreviewDimensions(exampleSource);
    assert.equal(dims.zoneW, 480);
    assert.equal(dims.zoneH, 320);
    assert.equal(dims.layout, "Layout1x1");
    assert.equal(isFullLcdSimulateZone(dims), true);
  });

  it("detects partial zones for layout simulation", () => {
    const source = `---@type WidgetScript\n---@simulate Layout2x2 zone=1\n`;
    const dims = resolvePreviewDimensions(source);
    assert.equal(isFullLcdSimulateZone(dims), false);
  });

  it("resolves Layout2x2 zone dimensions", () => {
    const source = `---@type WidgetScript\n---@simulate Layout2x2 zone=1\n`;
    const dims = resolvePreviewDimensions(source);
    assert.equal(dims.zoneW, 238);
    assert.equal(dims.zoneH, 158);
    assert.equal(dims.zoneX, 242);
  });

  it("validates unknown layout as error", () => {
    const source = `---@type WidgetScript\n---@simulate BadLayout zone=0\n`;
    const issues = validateDevKitAnnotations(source, TX15_SIMULATE_PROFILE);
    assert.ok(issues.some((i) => i.severity === "error" && i.message.includes("BadLayout")));
  });

  it("loads tx15 layout profile from shared layouts", () => {
    const profile = loadSimulateLayoutProfile("tx15");
    assert.equal(profile.lcdW, 480);
    assert.equal(profile.lcdH, 320);
  });

  it("resolves color272 layout for TX16 radio id", () => {
    const profile = loadSimulateLayoutProfile("tx16");
    assert.equal(profile.lcdH, 272);
    assert.equal(profile.lcdW, 480);
    assert.ok(profile.layouts.Layout2x2);
  });
});

describe("stub-aware validation", () => {
  it("accepts known lcd APIs from example", () => {
    const issues = validateStubApiCalls(exampleSource);
    const errors = issues.filter((i) => i.severity === "error");
    assert.equal(errors.length, 0);
  });

  it("flags unknown lcd method", () => {
    const issues = validateStubApiCalls('lcd.notARealMethod()');
    assert.ok(issues.some((i) => i.message.includes("notARealMethod")));
  });

  it("accepts lvgl.rectangle from nested stub index", () => {
    const issues = validateStubApiCalls("lvgl.rectangle({ x = 0, y = 0, w = 10, h = 10 })");
    const errors = issues.filter((i) => i.severity === "error");
    assert.equal(errors.length, 0);
  });

  it("validates example widget with dev-kit pipeline", () => {
    const result = validateWidgetLua(exampleSource, {
      simulateProfile: TX15_SIMULATE_PROFILE,
      strictDevKit: true,
    });
    assert.equal(result.valid, true);
    assert.equal(result.widgetName, "TX15Dash");
    const visualWarnings = result.issues.filter((i) =>
      /card panels|text density|SMLSIZE|grid/i.test(i.message)
    );
    assert.equal(visualWarnings.length, 0);
  });
});
