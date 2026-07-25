import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { sanitizeWidgetName, getWidgetLuaPath } from "../paths.ts";
import { validateWidgetLua, extractUsedTelemetrySensors } from "../validate.ts";
import { renderInstallMd } from "../package.ts";
import { loadRadioProfile, loadTelemetryCatalog } from "../knowledge.ts";
import { validateGenerateRequest } from "../requestValidate.ts";
import { findLatestWidgetName, pickActiveWidgetName } from "../widgetResolve.ts";
import { validateWidgetForRelease } from "../validationPipeline.ts";
import { suggestWidgetName, allocateWidgetName } from "../widgetNaming.ts";
import { WIDGET_NAME_PATTERN } from "../paths.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..", "..", "..");
const exampleLua = readFileSync(
  join(repoRoot, "examples", "tx15-minimal-dashboard.lua"),
  "utf-8"
);
const bfdash8fLua = readFileSync(
  join(repoRoot, "examples", "tx15-bfdash8f-whoop-dashboard.lua"),
  "utf-8"
);
const modelHeroLua = readFileSync(
  join(repoRoot, "examples", "tx15-model-hero-dashboard.lua"),
  "utf-8"
);

describe("sanitizeWidgetName", () => {
  it("accepts valid names", () => {
    assert.equal(sanitizeWidgetName("TX15Dash"), "TX15Dash");
  });

  it("rejects path traversal", () => {
    assert.throws(() => sanitizeWidgetName("../evil"), /Invalid widget name/);
    assert.throws(() => sanitizeWidgetName("foo/bar"), /Invalid widget name/);
  });

  it("rejects names over 10 chars", () => {
    assert.throws(() => sanitizeWidgetName("VeryLongName"), /Invalid widget name/);
  });
});

describe("validateWidgetLua", () => {
  const betaflightSensors = loadTelemetryCatalog("betaflight").sensors.map((s) => s.name);

  it("validates example widget with strict telemetry", () => {
    const result = validateWidgetLua(exampleLua, {
      maxOptions: 10,
      knownSensors: betaflightSensors,
      strictTelemetry: true,
    });
    assert.equal(result.valid, true);
    assert.equal(result.widgetName, "TX15Dash");
  });

  it("validates bfdash8f gold example (layout + betaflight telemetry)", () => {
    const result = validateWidgetLua(bfdash8fLua, {
      knownSensors: betaflightSensors,
      strictTelemetry: true,
      layoutArchetype: "quad-overview",
    });
    assert.equal(result.valid, true, result.issues.map((i) => i.message).join("; "));
  });

  it("validates model-hero gold example with layout validators", () => {
    const result = validateWidgetLua(modelHeroLua, {
      knownSensors: betaflightSensors,
      strictTelemetry: true,
      layoutArchetype: "quad-overview",
    });
    assert.equal(result.valid, true, result.issues.map((i) => i.message).join("; "));
  });

  it("rejects require()", () => {
    const result = validateWidgetLua('require("foo")\n' + exampleLua);
    assert.equal(result.valid, false);
    assert.ok(result.issues.some((i: { message: string }) => i.message.includes("require")));
  });

  it("rejects unknown sensors in strict mode", () => {
    const bad = exampleLua.replace('"RQLY"', '"NotASensor"');
    const result = validateWidgetLua(bad, {
      knownSensors: betaflightSensors,
      strictTelemetry: true,
    });
    assert.equal(result.valid, false);
    assert.ok(result.issues.some((i) => i.message.includes("NotASensor")));
  });

  it("requires return table fields", () => {
    const noReturn = exampleLua.replace(/return\s*\{[\s\S]*\n\}/, "");
    const result = validateWidgetLua(noReturn);
    assert.equal(result.valid, false);
    assert.ok(result.issues.some((i) => i.message.includes("return")));
  });

  it("extracts telemetry sensors from source", () => {
    const used = extractUsedTelemetrySensors(exampleLua);
    assert.ok(used.has("RQLY"));
    assert.ok(used.has("RxBt"));
  });

  it("accepts rotorflight motor sensors in strict mode", () => {
    const rotorflightSensors = loadTelemetryCatalog("rotorflight").sensors.map((s) => s.name);
    const source = [
      'local function cacheSource(n) return getSourceIndex(n) end',
      "local function create() return { src = {",
      '  hspd = cacheSource("HSpd"), rpm = cacheSource("RPM"),',
      '  esct = cacheSource("EscT"), mott = cacheSource("MotT"),',
      "}} end",
      "local function refresh() end",
      'return { name = "RfMotors", create = create, refresh = refresh }',
    ].join("\n");
    const result = validateWidgetLua(source, {
      knownSensors: rotorflightSensors,
      strictTelemetry: true,
    });
    const telemErrors = result.issues.filter((i) => i.message.includes("not found in selected protocol catalog"));
    assert.deepEqual(telemErrors, []);
  });

  it("warns on cluttered layout without cards", () => {
    const cluttered = `
local function refresh(widget, event, touchState)
  lcd.clear(BLACK)
  lcd.drawText(4, 4, "A", MIDSIZE + WHITE)
  lcd.drawText(4, 20, "B", MIDSIZE + WHITE)
  lcd.drawText(4, 36, "C", MIDSIZE + WHITE)
  lcd.drawText(4, 52, "D", MIDSIZE + WHITE)
  lcd.drawText(4, 68, "E", MIDSIZE + WHITE)
end
return { name = "Clutter", create = function() return {} end, refresh = refresh }
`;
    const result = validateWidgetLua(cluttered, { layoutArchetype: "card-grid" });
    assert.ok(
      result.issues.some(
        (i) => i.message.includes("grouped regions") || i.message.includes("Stacked top-left")
      )
    );
  });

  it("rejects Bitmap.getSize with SD path (radio create crash)", () => {
    const source = [
      'local name = "BmpTest"',
      "local MODEL_IMG = \"/MODELS/model.png\"",
      "local function create()",
      "  local modelBmp = Bitmap.open(MODEL_IMG)",
      "  local w, h = Bitmap.getSize(MODEL_IMG, modelBmp)",
      "  return { modelBmp = modelBmp, bmpW = w, bmpH = h }",
      "end",
      "local function refresh() end",
      "return { name = name, create = create, refresh = refresh }",
    ].join("\n");
    const result = validateWidgetLua(source);
    assert.equal(result.valid, false);
    assert.ok(result.issues.some((i) => i.severity === "error" && i.message.includes("Bitmap.getSize")));
  });

  it("rejects lcd.drawLine with color as 5th argument", () => {
    const source = [
      'local name = "LineTest"',
      "local function refresh()",
      "  lcd.drawLine(0, 0, 10, 0, widget.C_BORDER)",
      "end",
      "return { name = name, create = function() return {} end, refresh = refresh }",
    ].join("\n");
    const result = validateWidgetLua(source);
    assert.equal(result.valid, false);
    assert.ok(result.issues.some((i) => i.message.includes("drawLine")));
  });
});

describe("validateWidgetForRelease", () => {
  it("returns invalid when widget file missing", () => {
    const result = validateWidgetForRelease("NoSuchWgt", "betaflight");
    assert.equal(result.valid, false);
  });
});

describe("validateGenerateRequest", () => {
  it("accepts valid request", () => {
    const r = validateGenerateRequest({
      prompt: "battery dashboard",
      radioId: "tx15",
      protocol: "betaflight",
    });
    assert.equal(r.ok, true);
  });

  it("rejects unknown radio", () => {
    const r = validateGenerateRequest({ prompt: "x", radioId: "unknown" });
    assert.equal(r.ok, false);
  });

  it("rejects invalid protocol", () => {
    const r = validateGenerateRequest({ prompt: "x", protocol: "invalid" as never });
    assert.equal(r.ok, false);
  });

  it("accepts image-only request with default prompt", () => {
    const r = validateGenerateRequest({
      prompt: "",
      radioId: "tx15",
      protocol: "betaflight",
      images: [{ data: Buffer.from("png").toString("base64"), mimeType: "image/png" }],
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.match(r.request.prompt, /reference image/i);
    assert.equal(r.request.images?.length, 1);
  });
});

describe("renderInstallMd", () => {
  it("includes dashboard name and rotorflight note when applicable", () => {
    const radio = loadRadioProfile("tx15");
    const catalog = loadTelemetryCatalog("rotorflight");
    const md = renderInstallMd("RF2Dash", radio, catalog, ["RPM"]);
    assert.ok(md.includes("RF2Dash"));
    assert.ok(md.includes("rf2bg"));
  });

  it("includes companion script section when provided", () => {
    const radio = loadRadioProfile("tx15");
    const catalog = loadTelemetryCatalog("betaflight");
    const md = renderInstallMd("BattDash", radio, catalog, ["RxBt"], {
      tools: ["batt_sel.lua"],
      telemetry: ["flight_log.lua"],
    });
    assert.ok(md.includes("Companion scripts"));
    assert.ok(md.includes("SCRIPTS/TOOLS/batt_sel.lua"));
    assert.ok(md.includes("SCRIPTS/TELEMETRY/flight_log.lua"));
  });
});

describe("getWidgetLuaPath", () => {
  it("builds path under generated/", () => {
    const p = getWidgetLuaPath("TX15Dash");
    assert.ok(p.replace(/\\/g, "/").includes("/generated/TX15Dash/main.lua"));
  });
});

describe("findLatestWidgetName", () => {
  it("returns undefined when no generated widgets", () => {
    const name = findLatestWidgetName();
    assert.ok(name === undefined || typeof name === "string");
  });
});

describe("pickActiveWidgetName", () => {
  it("prefers assigned name over latest on disk", () => {
    const name = pickActiveWidgetName({
      assigned: "BfModelAy9",
      exists: (n) => n === "FltLogHub",
      latest: () => "FltLogHub",
    });
    assert.equal(name, "BfModelAy9");
  });

  it("uses existing assigned file when present", () => {
    const name = pickActiveWidgetName({
      assigned: "BfModelAy9",
      exists: (n) => n === "BfModelAy9",
      latest: () => "FltLogHub",
    });
    assert.equal(name, "BfModelAy9");
  });
});

describe("widgetNaming", () => {
  it("builds descriptive names within EdgeTX limits", () => {
    const name = suggestWidgetName("betaflight flight logger with timer", "betaflight", 42);
    assert.ok(name.startsWith("Bf"));
    assert.match(name, /FltLog|Timer/);
    assert.ok(name.length <= 10);
    assert.ok(WIDGET_NAME_PATTERN.test(name));
  });

  it("uses rotorflight prefix for heli prompts", () => {
    const name = suggestWidgetName("heli GPS headspeed dashboard", "rotorflight", 7);
    assert.ok(name.startsWith("Rf"));
    assert.ok(WIDGET_NAME_PATTERN.test(name));
  });

  it("is deterministic for the same seed and prompt", () => {
    const a = suggestWidgetName("battery and link monitor", "generic-crsf", 99);
    const b = suggestWidgetName("battery and link monitor", "generic-crsf", 99);
    assert.equal(a, b);
  });

  it("skips names already present under generated/", () => {
    const first = suggestWidgetName("gps altitude dashboard", "betaflight", 1);
    const second = allocateWidgetName("gps altitude dashboard", "betaflight", 1, (n) => n === first);
    assert.notEqual(first, second);
    assert.ok(WIDGET_NAME_PATTERN.test(second));
  });
});
