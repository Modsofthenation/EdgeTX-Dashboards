import {
  applyMockToCommands,
  getLastPreviewParseMeta,
  parseLuaToDrawCommandsStatic,
  type LayoutScenario,
  type PreviewDrawCommand,
  type PreviewParseMeta,
} from "@widget-gen/layout-verify";
import { getSimulateLayoutProfile } from "@widget-gen/shared";
import type {
  LuaPreviewWorkerRequest,
  LuaPreviewWorkerResponse,
} from "./luaPreviewWorkerProtocol.ts";

export type LuaPreviewResult = {
  commands: PreviewDrawCommand[];
  meta: PreviewParseMeta;
};

type Pending = {
  requestId: number;
  generation: number;
  resolve: (result: LuaPreviewResult) => void;
  reject: (err: Error) => void;
};

function resolveProfile(profileId: string) {
  try {
    return getSimulateLayoutProfile(profileId);
  } catch {
    return getSimulateLayoutProfile("tx15");
  }
}

/** Sync fallback used when the worker is unavailable or degraded. */
export function interpretPreviewSync(
  source: string,
  scenario: LayoutScenario,
  profileId = "tx15",
): LuaPreviewResult {
  const staticParse = parseLuaToDrawCommandsStatic(
    source,
    resolveProfile(profileId),
  );
  if (!staticParse) {
    return {
      commands: [],
      meta: {
        warnings: ["Could not parse refresh() body"],
        skippedTextCount: 0,
        zeroCoordCount: 0,
      },
    };
  }
  const commands = applyMockToCommands(staticParse, source, scenario);
  return { commands, meta: getLastPreviewParseMeta() };
}

/**
 * Main-thread client for the Lua preview worker.
 * Latest-wins: stale requestIds / generations are ignored.
 */
export class LuaPreviewWorkerClient {
  private worker: Worker | null = null;
  private degraded = false;
  private generation = 0;
  private nextRequestId = 1;
  private latestRequestId = 0;
  private pending = new Map<number, Pending>();
  private cachedSource: string | null = null;
  private cachedProfileId: string | null = null;

  private ensureWorker(): Worker | null {
    if (this.degraded) return null;
    if (this.worker) return this.worker;
    if (typeof Worker === "undefined") {
      this.degraded = true;
      return null;
    }
    try {
      const worker = new Worker(
        new URL("../workers/luaPreview.worker.ts", import.meta.url),
      );
      worker.onmessage = (event: MessageEvent<LuaPreviewWorkerResponse>) => {
        this.handleMessage(event.data);
      };
      worker.onerror = () => {
        this.degraded = true;
        for (const pending of this.pending.values()) {
          pending.reject(new Error("Lua preview worker failed"));
        }
        this.pending.clear();
        worker.terminate();
        this.worker = null;
      };
      this.worker = worker;
      return worker;
    } catch {
      this.degraded = true;
      return null;
    }
  }

  private handleMessage(msg: LuaPreviewWorkerResponse): void {
    if (msg.type === "error") {
      this.degraded = true;
      return;
    }
    if (msg.type !== "applyMockResult") return;
    const pending = this.pending.get(msg.requestId);
    if (!pending) return;
    this.pending.delete(msg.requestId);
    // Latest-wins + generation guard — always settle so callers are not stuck.
    if (
      msg.requestId !== this.latestRequestId ||
      msg.generation !== this.generation
    ) {
      pending.reject(new Error("Stale preview request"));
      return;
    }
    if (!msg.ok) {
      pending.reject(new Error(msg.error));
      return;
    }
    pending.resolve({ commands: msg.commands, meta: msg.meta });
  }

  private post(msg: LuaPreviewWorkerRequest): boolean {
    const worker = this.ensureWorker();
    if (!worker) return false;
    worker.postMessage(msg);
    return true;
  }

  /**
   * Ensure the worker has parsed `source` for the current generation.
   * Bumps generation when source/profile change.
   */
  setSource(source: string, profileId = "tx15"): number {
    if (
      this.cachedSource === source &&
      this.cachedProfileId === profileId &&
      this.generation > 0
    ) {
      return this.generation;
    }
    this.generation += 1;
    this.cachedSource = source;
    this.cachedProfileId = profileId;
    const posted = this.post({
      type: "setSource",
      generation: this.generation,
      source,
      profileId,
    });
    if (!posted) {
      // Sync path still uses generation for bookkeeping.
    }
    return this.generation;
  }

  /**
   * Apply mock/scenario for the current cached source.
   * Resolves with the latest result only (stale replies ignored by caller via requestId).
   */
  applyMock(
    scenario: LayoutScenario,
    generation = this.generation,
  ): Promise<LuaPreviewResult> {
    const requestId = this.nextRequestId++;
    this.latestRequestId = requestId;

    if (this.degraded || !this.ensureWorker()) {
      const source = this.cachedSource;
      if (!source) {
        return Promise.resolve({
          commands: [],
          meta: { warnings: [], skippedTextCount: 0, zeroCoordCount: 0 },
        });
      }
      return Promise.resolve(
        interpretPreviewSync(source, scenario, this.cachedProfileId ?? "tx15"),
      );
    }

    return new Promise<LuaPreviewResult>((resolve, reject) => {
      this.pending.set(requestId, { requestId, generation, resolve, reject });
      const posted = this.post({
        type: "applyMock",
        requestId,
        generation,
        scenario,
      });
      if (!posted) {
        this.pending.delete(requestId);
        const source = this.cachedSource;
        if (!source) {
          resolve({
            commands: [],
            meta: { warnings: [], skippedTextCount: 0, zeroCoordCount: 0 },
          });
          return;
        }
        resolve(
          interpretPreviewSync(
            source,
            scenario,
            this.cachedProfileId ?? "tx15",
          ),
        );
      }
    });
  }

  /** One-shot interpret (setSource + applyMock). */
  interpret(
    source: string,
    scenario: LayoutScenario,
    profileId = "tx15",
  ): Promise<LuaPreviewResult> {
    const generation = this.setSource(source, profileId);
    const requestId = this.nextRequestId++;
    this.latestRequestId = requestId;

    if (this.degraded || !this.ensureWorker()) {
      return Promise.resolve(interpretPreviewSync(source, scenario, profileId));
    }

    return new Promise<LuaPreviewResult>((resolve, reject) => {
      this.pending.set(requestId, { requestId, generation, resolve, reject });
      const posted = this.post({
        type: "interpret",
        requestId,
        generation,
        source,
        profileId,
        scenario,
      });
      if (!posted) {
        this.pending.delete(requestId);
        resolve(interpretPreviewSync(source, scenario, profileId));
      }
    });
  }

  /** Whether this requestId is still the latest outstanding request. */
  isLatest(requestId: number, generation: number): boolean {
    return requestId === this.latestRequestId && generation === this.generation;
  }

  get currentGeneration(): number {
    return this.generation;
  }

  get isDegraded(): boolean {
    return this.degraded;
  }

  dispose(): void {
    for (const pending of this.pending.values()) {
      pending.reject(new Error("Lua preview client disposed"));
    }
    this.pending.clear();
    this.worker?.terminate();
    this.worker = null;
    this.cachedSource = null;
    this.cachedProfileId = null;
    this.generation = 0;
    this.latestRequestId = 0;
  }
}

let sharedClient: LuaPreviewWorkerClient | null = null;

export function getLuaPreviewWorkerClient(): LuaPreviewWorkerClient {
  if (!sharedClient) sharedClient = new LuaPreviewWorkerClient();
  return sharedClient;
}

/** Test helper — reset the shared singleton. */
export function resetLuaPreviewWorkerClientForTests(): void {
  sharedClient?.dispose();
  sharedClient = null;
}
