/// <reference lib="webworker" />

import {
  applyMockToCommands,
  getLastPreviewParseMeta,
  parseLuaToDrawCommandsStatic,
  type PreviewStaticParse,
} from "@widget-gen/layout-verify";
import { getSimulateLayoutProfile } from "@widget-gen/shared";
import type {
  LuaPreviewWorkerRequest,
  LuaPreviewWorkerResponse,
} from "../lib/luaPreviewWorkerProtocol";

type CachedSource = {
  generation: number;
  source: string;
  staticParse: PreviewStaticParse;
};

let cached: CachedSource | null = null;

function post(msg: LuaPreviewWorkerResponse): void {
  self.postMessage(msg);
}

function resolveProfile(profileId: string) {
  try {
    return getSimulateLayoutProfile(profileId);
  } catch {
    return getSimulateLayoutProfile("tx15");
  }
}

function cacheSource(
  generation: number,
  source: string,
  profileId: string,
): PreviewStaticParse | null {
  const staticParse = parseLuaToDrawCommandsStatic(
    source,
    resolveProfile(profileId),
  );
  if (!staticParse) {
    cached = null;
    return null;
  }
  cached = { generation, source, staticParse };
  return staticParse;
}

function applyCached(
  requestId: number,
  generation: number,
  scenario: Parameters<typeof applyMockToCommands>[2],
): void {
  if (!cached || cached.generation !== generation) {
    post({
      type: "applyMockResult",
      requestId,
      generation,
      ok: false,
      error: "Preview source cache miss — setSource first",
    });
    return;
  }
  try {
    const commands = applyMockToCommands(
      cached.staticParse,
      cached.source,
      scenario,
    );
    const meta = getLastPreviewParseMeta();
    post({
      type: "applyMockResult",
      requestId,
      generation,
      ok: true,
      commands,
      meta,
    });
  } catch (err) {
    post({
      type: "applyMockResult",
      requestId,
      generation,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

self.onmessage = (event: MessageEvent<LuaPreviewWorkerRequest>) => {
  const msg = event.data;
  try {
    switch (msg.type) {
      case "setSource": {
        cacheSource(msg.generation, msg.source, msg.profileId);
        break;
      }
      case "applyMock": {
        applyCached(msg.requestId, msg.generation, msg.scenario);
        break;
      }
      case "interpret": {
        const staticParse = cacheSource(
          msg.generation,
          msg.source,
          msg.profileId,
        );
        if (!staticParse) {
          post({
            type: "applyMockResult",
            requestId: msg.requestId,
            generation: msg.generation,
            ok: false,
            error: "Could not parse refresh() body",
          });
          break;
        }
        applyCached(msg.requestId, msg.generation, msg.scenario);
        break;
      }
    }
  } catch (err) {
    post({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
