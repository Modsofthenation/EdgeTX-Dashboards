import { randomUUID } from "node:crypto";
import type { GenerateSession, TelemetryProtocol } from "@widget-gen/shared";
import { WidgetGenerator } from "./agent.js";

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

  createSession(radioId: string, protocol: TelemetryProtocol): GenerateSession {
    this.evictExpired();
    const id = randomUUID();
    const generator = new WidgetGenerator();
    const session: GenerateSession = {
      id,
      agentId: "",
      radioId,
      protocol,
      createdAt: Date.now(),
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

export function getSessionStore(): SessionStore {
  if (!globalStore) {
    globalStore = new SessionStore();
  }
  return globalStore;
}
