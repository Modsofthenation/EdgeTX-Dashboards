import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateWidgetSource } from "@widget-gen/generator";
import { luaToScene, sceneToLua } from "./index.ts";
import { snapToGrid, hitTestElements, createDefaultElement } from "./index.ts";
import { newElementId } from "./ids.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../../..");
const goldExample = readFileSync(
  join(repoRoot, "examples/tx15-minimal-dashboard.lua"),
  "utf-8",
);
const modelHeroExample = readFileSync(
  join(repoRoot, "examples/tx15-model-hero-dashboard.lua"),
  "utf-8",
);

describe("sceneToLua round-trip", () => {
  it("imports gold example and exports valid Lua", () => {
    const { scene, warnings } = luaToScene(goldExample);
    assert.ok(
      scene.elements.length > 0,
      `expected elements, warnings: ${warnings.join("; ")}`,
    );

    const exported = sceneToLua(scene);
    const result = validateWidgetSource(exported, "betaflight", {
      strictTelemetry: true,
    });

    const errors = result.issues.filter((i) => i.severity === "error");
    assert.equal(
      errors.length,
      0,
      `validation errors: ${errors.map((e) => e.message).join("; ")}`,
    );
  });

  it("exports model-hero import without invalid drawBitmap path", () => {
    const { scene } = luaToScene(modelHeroExample);
    const elements = scene.elements.some((el) => el.kind === "bitmap")
      ? scene.elements
      : [
          ...scene.elements,
          createDefaultElement("bitmap", newElementId("bitmap")),
        ];

    const exported = sceneToLua({ ...scene, elements });
    assert.match(exported, /Bitmap\.open/);
    assert.match(exported, /widget\.modelBmp/);
    assert.doesNotMatch(exported, /drawBitmap\(model\.getInfo\(\)\.bitmap/);
  });

  it("exports all primitive kinds without syntax errors", () => {
    const kinds = [
      "text",
      "filledRect",
      "rect",
      "line",
      "gauge",
      "circle",
      "filledCircle",
      "arc",
      "annulus",
      "bitmap",
    ] as const;

    const elements = kinds.map((kind, i) => {
      const el = createDefaultElement(kind, newElementId(kind));
      const col = i % 4;
      const row = Math.floor(i / 4);
      const ox = col * 110 + 20;
      const oy = row * 90 + 20;
      if ("x" in el && "y" in el) {
        el.x = ox;
        el.y = oy;
      }
      if (el.kind === "line") {
        el.x1 = ox;
        el.y1 = oy;
        el.x2 = ox + 60;
        el.y2 = oy;
      }
      return el;
    });
    const scene = {
      name: "PrimTest",
      simulate: { layout: "Layout1x1", zone: 0 },
      options: [],
      telemetry: [],
      elements: [...elements],
    };

    const exported = sceneToLua(scene);
    assert.match(exported, /lcd\.drawText/);
    assert.match(exported, /lcd\.drawFilledRectangle/);
    assert.match(exported, /lcd\.drawGauge/);
    assert.match(exported, /lcd\.drawAnnulus/);
    assert.match(exported, /Bitmap\.open/);
    assert.match(exported, /widget\.modelBmp/);

    const result = validateWidgetSource(exported, "betaflight", {
      strictTelemetry: false,
    });
    const errors = result.issues.filter((i) => i.severity === "error");
    assert.equal(errors.length, 0, errors.map((e) => e.message).join("; "));
  });
});

describe("geometry", () => {
  it("snaps to 12px grid", () => {
    assert.equal(snapToGrid(13), 12);
    assert.equal(snapToGrid(18), 24);
    assert.equal(snapToGrid(13, 12, false), 13);
  });

  it("hit-tests topmost element", () => {
    const a = createDefaultElement("filledRect", "a");
    const b = createDefaultElement("text", "b");
    if (a.kind === "filledRect") {
      a.x = 100;
      a.y = 100;
      a.w = 80;
      a.h = 60;
    }
    if (b.kind === "text") {
      b.x = 110;
      b.y = 110;
    }

    const hit = hitTestElements([a, b], 115, 115);
    assert.equal(hit, "b");
  });
});
