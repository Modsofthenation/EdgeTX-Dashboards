import { BASE_MOCK, type DrawRecord } from "@widget-gen/layout-verify";
import { interpretDocument, patchRecordArgs } from "../luaDocument.ts";
import type { EditorElement, WidgetScene } from "../types.ts";

export interface SceneGeometryZone {
  x: number;
  y: number;
  w: number;
  h: number;
}

function geometryPatch(
  element: EditorElement,
  zone: SceneGeometryZone,
): Record<string, number> {
  const x = (value: number) => value + zone.x;
  const y = (value: number) => value + zone.y;

  switch (element.kind) {
    case "text":
    case "bitmap":
      return { x: x(element.x), y: y(element.y) };
    case "filledRect":
    case "rect":
    case "gauge":
      return {
        x: x(element.x),
        y: y(element.y),
        w: element.w,
        h: element.h,
      };
    case "line":
      return {
        x: x(element.x1),
        y: y(element.y1),
        x2: x(element.x2),
        y2: y(element.y2),
      };
    case "circle":
    case "filledCircle":
      return { x: x(element.x), y: y(element.y), r: element.r };
    case "arc":
      return { x: x(element.x), y: y(element.y), r: element.r };
    case "annulus":
      return {
        x: x(element.x),
        y: y(element.y),
        rIn: element.rIn,
        rOut: element.rOut,
      };
  }
}

function recordForElement(
  records: DrawRecord[],
  element: EditorElement,
): DrawRecord | undefined {
  return records.find(
    (record) =>
      record.kind === element.kind &&
      (record.sourceRef?.sourceLine ?? record.sourceLine) ===
        element.sourceLine,
  );
}

/**
 * Surgically sync scene geometry back to the source-linked lcd calls.
 * Scene coordinates are zone-relative; luaDocument converts LCD coordinates
 * back to source-relative arguments while preserving the surrounding Lua.
 */
export function applySceneGeometryToSource(
  source: string,
  scene: WidgetScene,
  zone: SceneGeometryZone,
  elementIds?: string[],
): string {
  const selected = elementIds ? new Set(elementIds) : null;
  const records = interpretDocument(source, {
    id: "scene-geometry",
    mock: BASE_MOCK,
    options: Object.fromEntries(
      scene.options.map((option) => [option.name, option.defaultValue]),
    ),
  });
  const zoneOffset = {
    zoneX: zone.x,
    zoneY: zone.y,
    zoneW: zone.w,
    zoneH: zone.h,
  };
  let next = source;

  for (const element of scene.elements) {
    if (element.sourceLine == null) continue;
    if (
      selected &&
      !selected.has(element.id) &&
      !selected.has(`L${element.sourceLine}`)
    ) {
      continue;
    }
    const record = recordForElement(records, element);
    if (!record) continue;
    next = patchRecordArgs(
      next,
      record,
      geometryPatch(element, zone),
      zoneOffset,
    );
  }

  return next;
}
