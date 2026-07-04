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

export interface StreamEvent {
  type: "text" | "tool" | "status" | "error" | "done";
  content: string;
  runId?: string;
  agentId?: string;
}

export interface GenerateSession {
  id: string;
  agentId: string;
  radioId: string;
  protocol: TelemetryProtocol;
  createdAt: number;
  lastRunId?: string;
  widgetName?: string;
  validated?: boolean;
  validationIssues?: ValidationIssue[];
}
