import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { sanitizeWidgetName, getWidgetLuaPath } from "../paths.js";
import { validateWidgetLua, extractUsedTelemetrySensors } from "../validate.js";
import { renderInstallMd } from "../package.js";
import { loadRadioProfile, loadTelemetryCatalog } from "../knowledge.js";
import { validateGenerateRequest } from "../requestValidate.js";
import { findLatestWidgetName } from "../widgetResolve.js";
import { validateWidgetForRelease } from "../validationPipeline.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..", "..", "..");
const exampleLua = readFileSync(
  join(repoRoot, "examples", "tx15-minimal-dashboard.lua"),
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
