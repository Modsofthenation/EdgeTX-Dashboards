import type { MockTelemetry } from "./mockTelemetry.ts";

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

/** Character span of one lcd.* call argument within its source line (0-based, end exclusive). */
export interface ArgSpan {
  start: number;
  end: number;
}

/** Anchors a draw record to its originating lcd.* source line for in-place patching. */
export interface DrawSourceRef {
  /** 1-based line number in the full Lua source file */
  sourceLine: number;
  /** lcd method name, e.g. drawText */
  method: string;
  /** Argument spans within the source line text */
  args: ArgSpan[];
}

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
  /** Original lcd.* line when available (1-based, full file) */
  sourceLine?: number;
  /** Source anchors for surgical line patching */
  sourceRef?: DrawSourceRef;
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
  /** Simulated widget.flightSecs for timer display in static preview */
  flightSecs?: number;
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
