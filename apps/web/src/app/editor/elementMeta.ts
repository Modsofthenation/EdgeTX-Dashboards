import type { ElementKind } from "@widget-gen/editor-core";
import type { DrawKind } from "@widget-gen/layout-verify";
import type { EditorElement } from "@widget-gen/editor-core";

export type InsertDrawKind =
  | "text"
  | "filledRect"
  | "rect"
  | "line"
  | "gauge"
  | "circle"
  | "filledCircle"
  | "arc"
  | "annulus"
  | "bitmap";

export const ELEMENT_CATALOG: {
  kind: ElementKind;
  label: string;
  shortLabel: string;
  description: string;
}[] = [
  { kind: "text", label: "Text", shortLabel: "T", description: "Label or value" },
  { kind: "filledRect", label: "Filled rectangle", shortLabel: "▣", description: "Card background" },
  { kind: "rect", label: "Rectangle", shortLabel: "□", description: "Border outline" },
  { kind: "line", label: "Line", shortLabel: "／", description: "Divider or connector" },
  { kind: "gauge", label: "Gauge", shortLabel: "◔", description: "Bar gauge" },
  { kind: "circle", label: "Circle", shortLabel: "○", description: "Circle outline" },
  { kind: "filledCircle", label: "Filled circle", shortLabel: "●", description: "Solid disc" },
  { kind: "arc", label: "Arc", shortLabel: "◠", description: "Arc segment" },
  { kind: "annulus", label: "Annulus", shortLabel: "◎", description: "Ring gauge" },
  { kind: "bitmap", label: "Bitmap", shortLabel: "🖼", description: "Model image" },
];

export const DRAW_KIND_CATALOG: {
  kind: InsertDrawKind;
  label: string;
  shortLabel: string;
  description: string;
}[] = [
  { kind: "text", label: "Text", shortLabel: "T", description: "Label or value" },
  { kind: "filledRect", label: "Filled rectangle", shortLabel: "▣", description: "Card background" },
  { kind: "rect", label: "Rectangle", shortLabel: "□", description: "Border outline" },
  { kind: "line", label: "Line", shortLabel: "／", description: "Divider or connector" },
  { kind: "gauge", label: "Gauge", shortLabel: "◔", description: "Bar gauge" },
  { kind: "circle", label: "Circle", shortLabel: "○", description: "Circle outline" },
  { kind: "filledCircle", label: "Filled circle", shortLabel: "●", description: "Solid disc" },
  { kind: "arc", label: "Arc", shortLabel: "◠", description: "Arc segment" },
  { kind: "annulus", label: "Annulus", shortLabel: "◎", description: "Ring gauge" },
  { kind: "bitmap", label: "Bitmap", shortLabel: "🖼", description: "Model image" },
];

export function catalogForKind(kind: ElementKind) {
  return ELEMENT_CATALOG.find((e) => e.kind === kind);
}

export function catalogForDrawKind(kind: DrawKind | InsertDrawKind) {
  return DRAW_KIND_CATALOG.find((e) => e.kind === kind);
}

export function layerLabel(el: EditorElement): string {
  if (el.label) return el.label;
  return catalogForKind(el.kind)?.label ?? el.kind;
}
