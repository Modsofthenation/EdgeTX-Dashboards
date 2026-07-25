import { randomUUID } from "node:crypto";
import type { GenerateSession, TelemetryProtocol } from "@widget-gen/shared";
import { WidgetGenerator } from "./agent.ts";
import { deriveVariationSeed } from "./designVariation.ts";

const SESSION_TTL_MS = 60 * 60 * 1000;
export const MAX_ACTIVE_SESSIONS = 10;

interface StoredSession {
  session: GenerateSession;
  generator: WidgetGenerator;
  busy: boolean;
}

export interface RestoreSessionInput {
  id?: string;
  radioId: string;
  protocol: TelemetryProtocol;
  modelId?: string;
  widgetName?: string;
  widgetInstanceId?: string;
  widgetVersion?: number;
}

export class SessionStore {
  private sessions = new Map<string, StoredSession>();

  get activeCount(): number {
    return this.sessions.size;
  }

  createSession(
    radioId: string,
    protocol: TelemetryProtocol,
    modelId = "composer-2.5"
  ): GenerateSession {
    this.evictExpired();
    const id = randomUUID();
    const generator = new WidgetGenerator(undefined, { protocol, radioId });
    const session: GenerateSession = {
      id,
      agentId: "",
      radioId,
      protocol,
      modelId,
      createdAt: Date.now(),
      runIndex: 0,
      variationSeed: deriveVariationSeed(id, 0),
    };
    this.sessions.set(id, { session, generator, busy: false });
    return session;
  }

  get(id: string): StoredSession | undefined {
    this.evictExpired();
    return this.sessions.get(id);
  }

  /** Recreate an in-memory session for a persisted chat (after TTL expiry or server restart). */
  restoreSession(input: RestoreSessionInput): GenerateSession {
    this.evictExpired();

    const id = input.id ?? randomUUID();
    const existing = this.sessions.get(id);
    if (existing) {
      if (input.widgetName) {
        existing.session.widgetName = input.widgetName;
      }
      if (input.widgetInstanceId) {
        existing.session.widgetInstanceId = input.widgetInstanceId;
      }
      if (input.widgetVersion !== undefined) {
        existing.session.widgetVersion = input.widgetVersion;
      }
      existing.generator.resolveWidgetWorkspaceKey(
        input.widgetInstanceId ?? input.widgetName
      );
      return existing.session;
    }

    const modelId = input.modelId ?? "composer-2.5";
    const generator = new WidgetGenerator(undefined, {
      protocol: input.protocol,
      radioId: input.radioId,
      widgetName: input.widgetName,
      widgetInstanceId: input.widgetInstanceId,
      widgetVersion: input.widgetVersion,
    });
    if (input.widgetInstanceId ?? input.widgetName) {
      generator.resolveWidgetWorkspaceKey(input.widgetInstanceId ?? input.widgetName);
    }

    const session: GenerateSession = {
      id,
      agentId: "",
      radioId: input.radioId,
      protocol: input.protocol,
      modelId,
      createdAt: Date.now(),
      runIndex: 0,
      variationSeed: deriveVariationSeed(id, 0),
      widgetName: input.widgetName,
      widgetInstanceId: input.widgetInstanceId,
      widgetVersion: input.widgetVersion ?? 0,
    };
    this.sessions.set(id, { session, generator, busy: false });
    return session;
  }

  tryAcquire(id: string): StoredSession | undefined {
    const stored = this.get(id);
    if (!stored || stored.busy) return undefined;
    stored.busy = true;
    return stored;
  }

  release(id: string): void {
    const stored = this.sessions.get(id);
    if (stored) stored.busy = false;
  }

  async dispose(id: string): Promise<void> {
    const stored = this.sessions.get(id);
    if (stored) {
      stored.busy = false;
      await stored.generator.dispose();
      this.sessions.delete(id);
    }
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [id, stored] of this.sessions) {
      if (now - stored.session.createdAt > SESSION_TTL_MS) {
        stored.generator.dispose().catch(() => {});
        this.sessions.delete(id);
      }
    }
  }
}

let globalStore: SessionStore | null = null;

const SESSION_STORE_KEY = Symbol.for("@widget-gen/sessionStore");

function getGlobalStore(): SessionStore {
  const g = globalThis as typeof globalThis & { [SESSION_STORE_KEY]?: SessionStore };
  if (!g[SESSION_STORE_KEY]) {
    g[SESSION_STORE_KEY] = new SessionStore();
  }
  return g[SESSION_STORE_KEY];
}

export function getSessionStore(): SessionStore {
  if (!globalStore) {
    globalStore = getGlobalStore();
  }
  return globalStore;
}
