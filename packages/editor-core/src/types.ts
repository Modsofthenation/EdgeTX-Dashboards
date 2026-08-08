import type { SimulateAnnotation } from "@widget-gen/shared";

export type ElementKind =
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

export type ImportConfidence = "high" | "low";

export interface WidgetOption {
  name: string;
  defaultValue: 0 | 1;
}

export interface TelemetryBinding {
  /** Field name on widget.src (e.g. rqly). */
  key: string;
  /** CRSF sensor label passed to getSourceIndex (e.g. RQLY). */
  sensor: string;
}

export type TextFormat =
  "raw" | "percent" | "float1" | "float1_amps" | "string";

export interface TextBinding {
  sensorKey: string;
  format?: TextFormat;
  prefix?: string;
  suffix?: string;
}

export interface BaseElement {
  id: string;
  visible: boolean;
  optionGate?: string;
  label?: string;
  importConfidence?: ImportConfidence;
  /** Lua source line when imported from interpret — bridges scene → record selection. */
  sourceLine?: number;
}

export interface TextElement extends BaseElement {
  kind: "text";
  x: number;
  y: number;
  content?: string;
  binding?: TextBinding;
  fontSize: number;
  color: string;
  textAlign?: "left" | "center" | "right";
  fontFlags?: string[];
}

export interface RectElement extends BaseElement {
  kind: "filledRect" | "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  /** Progress bar fill driven by telemetry (0–100). */
  dynamicWidth?: { sensorKey: string };
}

export interface LineElement extends BaseElement {
  kind: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  pattern?: "SOLID" | "DOTTED";
}

export interface GaugeElement extends BaseElement {
  kind: "gauge";
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  fill: number;
  maxFill: number;
}

export interface CircleElement extends BaseElement {
  kind: "circle" | "filledCircle";
  x: number;
  y: number;
  r: number;
  color: string;
}

export interface ArcElement extends BaseElement {
  kind: "arc";
  x: number;
  y: number;
  r: number;
  startAngle: number;
  endAngle: number;
  color: string;
}

export interface AnnulusElement extends BaseElement {
  kind: "annulus";
  x: number;
  y: number;
  rIn: number;
  rOut: number;
  startAngle: number;
  endAngle: number;
  color: string;
}

export interface BitmapElement extends BaseElement {
  kind: "bitmap";
  x: number;
  y: number;
  placeholder: "model";
  scale?: number;
}

export type EditorElement =
  | TextElement
  | RectElement
  | LineElement
  | GaugeElement
  | CircleElement
  | ArcElement
  | AnnulusElement
  | BitmapElement;

export interface WidgetScene {
  name: string;
  simulate: SimulateAnnotation;
  options: WidgetOption[];
  telemetry: TelemetryBinding[];
  elements: EditorElement[];
}

export interface LuaToSceneResult {
  scene: WidgetScene;
  warnings: string[];
}
