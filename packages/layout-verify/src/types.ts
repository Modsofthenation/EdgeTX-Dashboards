import type { MockTelemetry } from "./mockTelemetry.js";

export type DrawKind =
  | "clear"
  | "text"
  | "filledRect"
  | "rect"
  | "line"
  | "bitmap"
  | "gauge"
  | "circle"
  | "filledCircle"
  | "arc"
  | "annulus";

export interface DrawRecord {
  kind: DrawKind;
  color?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  r?: number;
  rIn?: number;
  rOut?: number;
  startAngle?: number;
  endAngle?: number;
  fill?: number;
  maxFill?: number;
  text?: string;
  fontSize?: number;
  textAlign?: "left" | "center" | "right";
  x2?: number;
  y2?: number;
  placeholder?: "model";
  /** Original lcd.* line when available */
  sourceLine?: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutScenario {
  id: string;
  mock: MockTelemetry;
  options?: Record<string, 0 | 1>;
  armed?: boolean;
}

export interface InterpretResult {
  records: DrawRecord[];
  warnings: string[];
  skippedTextCount: number;
  zeroCoordCount: number;
}

export interface OverlapHit {
  a: DrawRecord;
  b: DrawRecord;
  aIndex: number;
  bIndex: number;
  intersection: BoundingBox;
}
