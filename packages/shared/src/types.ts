export type TelemetryProtocol = "betaflight" | "rotorflight" | "generic-crsf";

export type TelemetryCategory =
  | "link"
  | "battery"
  | "gps"
  | "attitude"
  | "flight"
  | "motor"
  | "all";

export interface RadioProfile {
  id: string;
  name: string;
  lcdW: number;
  lcdH: number;
  touch: boolean;
  maxOptions: number;
  edgeTxMin: string;
  /** Simulate/layout profile key when it differs from radio id (e.g. shared 480×272 class). */
  layoutProfile?: string;
  notes?: string;
}

export interface TelemetrySensor {
  name: string;
  unit: string;
  category: TelemetryCategory;
  description: string;
  requiresCustomCrsf?: boolean;
}

export interface TelemetryCatalog {
  protocol: TelemetryProtocol;
  label: string;
  sensors: TelemetrySensor[];
  setupNotes?: string[];
}

export interface GenerateRequest {
  prompt: string;
  radioId: string;
  protocol: TelemetryProtocol;
  edgeTxVersion?: string;
  modelId?: string;
}

export interface RefineRequest {
  sessionId: string;
  prompt: string;
}

export interface ValidationIssue {
  severity: "error" | "warning";
  message: string;
  line?: number;
}

export interface ValidationResult {
  valid: boolean;
  widgetName?: string;
  issues: ValidationIssue[];
}

export type StreamTodoStatus = "pending" | "in_progress" | "completed" | "cancelled";

export interface StreamTodoItem {
  id: string;
  content: string;
  status: StreamTodoStatus;
}

export interface StreamEvent {
  type: "text" | "tool" | "todo" | "status" | "error" | "done";
  content: string;
  detail?: string;
  todos?: StreamTodoItem[];
  toolName?: string;
  runId?: string;
  agentId?: string;
}

export interface GenerateSession {
  id: string;
  agentId: string;
  radioId: string;
  protocol: TelemetryProtocol;
  modelId: string;
  createdAt: number;
  lastRunId?: string;
  /** EdgeTX radio display name (≤10 chars). */
  widgetName?: string;
  /** UUID workspace folder — unique even when display names collide. */
  widgetInstanceId?: string;
  /** Number of refines applied (0 = initial generation). */
  widgetVersion?: number;
  validated?: boolean;
  validationIssues?: ValidationIssue[];
  /** Per-session seed for layout/color variety across runs. */
  variationSeed?: number;
  /** Incremented on refinements that change layout intent. */
  runIndex?: number;
  layoutArchetypeId?: string;
}
