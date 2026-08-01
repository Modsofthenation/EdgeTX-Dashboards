import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getSimulateLayoutProfile,
  resolvePreviewDimensions,
} from "@widget-gen/shared";
import { applySceneGeometryToSource } from "./applySceneGeometry.ts";
import { luaToScene } from "../import/luaToScene.ts";

const source = `---@type WidgetScript
---@simulate Layout1x1 zone=0
local name = "Geometry"
local function create(zone, opts)
  return { zone = zone, options = opts }
end
local function refresh(widget)
  local pad = 12
  lcd.drawFilledRectangle(pad, 20, 80, 40, DARKGREY)
  lcd.drawText(12, 70, "Keep me", SMLSIZE + WHITE)
  lcd.drawLine(12, 100, 80, 120, SOLID, WHITE)
end
return { name = name, create = create, refresh = refresh }
`;

function zoneForSource() {
  const dims = resolvePreviewDimensions(
    source,
    getSimulateLayoutProfile("tx15"),
  );
  return { x: dims.zoneX, y: dims.zoneY, w: dims.zoneW, h: dims.zoneH };
}

test("applies filtered scene geometry without rewriting other Lua", () => {
  const { scene } = luaToScene(source);
  const rectangle = scene.elements.find(
    (element) => element.kind === "filledRect",
  );
  assert.ok(rectangle && rectangle.kind === "filledRect");

  const updatedScene = {
    ...scene,
    elements: scene.elements.map((element) =>
      element.id === rectangle.id
        ? { ...element, x: 24, y: 32, w: 96, h: 48 }
        : element,
    ),
  };
  const result = applySceneGeometryToSource(
    source,
    updatedScene,
    zoneForSource(),
    [rectangle.id],
  );

  assert.match(result, /lcd\.drawFilledRectangle\(24, 32, 96, 48, DARKGREY\)/);
  assert.match(result, /lcd\.drawText\(12, 70, "Keep me", SMLSIZE \+ WHITE\)/);
  assert.match(result, /local pad = 12/);
});

test("syncs line endpoints from scene geometry", () => {
  const { scene } = luaToScene(source);
  const line = scene.elements.find((element) => element.kind === "line");
  assert.ok(line && line.kind === "line");

  const updatedScene = {
    ...scene,
    elements: scene.elements.map((element) =>
      element.id === line.id
        ? { ...element, x1: 20, y1: 90, x2: 110, y2: 130 }
        : element,
    ),
  };
  const result = applySceneGeometryToSource(
    source,
    updatedScene,
    zoneForSource(),
    [line.id],
  );

  assert.match(result, /lcd\.drawLine\(20, 90, 110, 130, SOLID, WHITE\)/);
});
