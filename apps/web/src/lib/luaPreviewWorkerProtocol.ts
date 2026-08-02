/** Message protocol for the Lua preview applyMock worker. */

import type {
  LayoutScenario,
  PreviewDrawCommand,
  PreviewParseMeta,
} from "@widget-gen/layout-verify";

export type LuaPreviewWorkerRequest =
  | {
      type: "setSource";
      generation: number;
      source: string;
      profileId: string;
    }
  | {
      type: "applyMock";
      requestId: number;
      generation: number;
      scenario: LayoutScenario;
    }
  | {
      type: "interpret";
      requestId: number;
      generation: number;
      source: string;
      profileId: string;
      scenario: LayoutScenario;
    };

export type LuaPreviewWorkerResponse =
  | {
      type: "applyMockResult";
      requestId: number;
      generation: number;
      ok: true;
      commands: PreviewDrawCommand[];
      meta: PreviewParseMeta;
    }
  | {
      type: "applyMockResult";
      requestId: number;
      generation: number;
      ok: false;
      error: string;
    }
  | { type: "error"; message: string };
