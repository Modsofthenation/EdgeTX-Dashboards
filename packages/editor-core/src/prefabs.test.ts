import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getPrefabSection,
  insertPrefabSection,
  insertPrefabSections,
  listPrefabCatalog,
  listPrefabSections,
  STACYDASH_TX15_LAYOUT_ORDER,
  STACYDASH_ROTORFLIGHT_PREFABS,
} from "./prefabs/index.ts";
import { interpretDocument } from "./luaDocument.ts";
import { validateWidgetLua, loadTelemetryCatalog } from "@widget-gen/generator";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..", "..");

const MINIMAL_SHELL = `---@type WidgetScript
---@simulate Layout1x1 zone=0
local name = "RfTest1"
local options = {}
local function cacheSource(sensorName)
  local idx = getSourceIndex(sensorName)
  if idx and idx > 0 then return idx end
  return nil
end
local function telem(id)
  if id then return getValue(id) end
  return 0
end
local function create(zone, opts)
  return { zone = zone, options = opts, src = {} }
end
local function refresh(widget)
  lcd.clear(BLACK)
end
return {
  name = name,
  options = options,
  create = create,
  refresh = refresh,
}
`;

describe("StacyDash Rotorflight prefabs", () => {
  it("registers six TX15 sections", () => {
    assert.equal(STACYDASH_ROTORFLIGHT_PREFABS.length, 6);
    assert.deepEqual(
      listPrefabSections({ protocol: "rotorflight" }).map((p) => p.id),
      [...STACYDASH_TX15_LAYOUT_ORDER],
    );
    assert.deepEqual(
      listPrefabSections({ protocol: "betaflight" }),
      [],
      "StacyDash prefabs are rotorflight-only",
    );
  });

  it("exposes catalog entries with telemetry notes", () => {
    const catalog = listPrefabCatalog({ protocol: "rotorflight" });
    assert.ok(catalog.every((c) => c.telemetryNotes.length > 0));
    const hero = catalog.find((c) => c.id === "rf-headspeed-hero");
    assert.ok(hero);
    assert.ok(hero!.requiredSensors.includes("HSpd"));
  });

  for (const id of STACYDASH_TX15_LAYOUT_ORDER) {
    it(`inserts ${id} with lcd draws and sensor cache`, () => {
      const prefab = getPrefabSection(id)!;
      const result = insertPrefabSection(MINIMAL_SHELL, id);
      assert.ok(result);
      assert.ok(result!.insertedDrawCount > 0);
      for (const [key, sensor] of Object.entries(prefab.createSrcBindings)) {
        assert.match(
          result!.source,
          new RegExp(`${key}\\s*=\\s*cacheSource\\("${sensor}"`),
        );
      }
      for (const line of prefab.refreshLines) {
        if (line.startsWith("lcd.")) {
          assert.ok(
            result!.source.includes(line),
            `missing draw line: ${line}`,
          );
        }
      }
      const records = interpretDocument(result!.source);
      assert.ok(
        records.some((r) => r.kind === "filledRect" || r.kind === "text"),
        "expected interpretable draw records",
      );
    });
  }

  it("assembles full layout without losing helpers", () => {
    const { source, inserted } = insertPrefabSections(MINIMAL_SHELL, [
      ...STACYDASH_TX15_LAYOUT_ORDER,
    ]);
    assert.deepEqual(inserted, [...STACYDASH_TX15_LAYOUT_ORDER]);
    assert.equal(
      (source.match(/function cacheSource/g) || []).length,
      1,
      "cacheSource should not be duplicated",
    );
    assert.equal((source.match(/function telem/g) || []).length, 1);
  });

  it("validates programmatically assembled full StacyDash board", () => {
    const { source } = insertPrefabSections(MINIMAL_SHELL, [
      ...STACYDASH_TX15_LAYOUT_ORDER,
    ]);
    const sensors = loadTelemetryCatalog("rotorflight").sensors.map(
      (s) => s.name,
    );
    const result = validateWidgetLua(source, {
      knownSensors: sensors,
      strictTelemetry: true,
      layoutArchetype: "heli-rotorflight",
      userPrompt:
        "StacyDash Rotorflight headspeed ESC temperature battery board",
      strictIntent: true,
    });
    const errors = result.issues.filter((i) => i.severity === "error");
    assert.equal(errors.length, 0, errors.map((e) => e.message).join("; "));
    assert.equal(result.valid, true);
  });

  it("validates gold example against rotorflight catalog", () => {
    const example = readFileSync(
      join(repoRoot, "examples", "tx15-stacydash-sections.lua"),
      "utf8",
    );
    const sensors = loadTelemetryCatalog("rotorflight").sensors.map(
      (s) => s.name,
    );
    const result = validateWidgetLua(example, {
      knownSensors: sensors,
      strictTelemetry: true,
      layoutArchetype: "heli-rotorflight",
      userPrompt:
        "StacyDash Rotorflight headspeed ESC temperature battery board",
      strictIntent: true,
    });
    const errors = result.issues.filter((i) => i.severity === "error");
    assert.equal(errors.length, 0, errors.map((e) => e.message).join("; "));
    assert.equal(result.valid, true);
  });

  it("required sensors exist in rotorflight catalog", () => {
    const known = new Set(
      loadTelemetryCatalog("rotorflight").sensors.map((s) => s.name),
    );
    for (const prefab of STACYDASH_ROTORFLIGHT_PREFABS) {
      for (const sensor of [
        ...prefab.requiredSensors,
        ...prefab.optionalSensors,
        ...Object.values(prefab.createSrcBindings),
      ]) {
        assert.ok(
          known.has(sensor),
          `${prefab.id} references unknown sensor ${sensor}`,
        );
      }
    }
  });
});
