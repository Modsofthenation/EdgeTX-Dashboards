import { randomUUID } from "node:crypto";
import type { GenerateSession, TelemetryProtocol } from "@widget-gen/shared";
import { WidgetGenerator } from "./agent.js";
import { deriveVariationSeed } from "./designVariation.js";

const SESSION_TTL_MS = 60 * 60 * 1000;
export const MAX_ACTIVE_SESSIONS = 10;

interface StoredSession {
  session: GenerateSession;
  generator: WidgetGenerator;
  busy: boolean;
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
    const generator = new WidgetGenerator();
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
