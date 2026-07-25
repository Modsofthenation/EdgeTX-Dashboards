import type { WidgetSnapshot, WidgetVersionEntry } from "~/lib/chatTypes";
import { snapshotToVersionEntry, versionEntryToSnapshot } from "~/lib/chatTypes";

/** Latest version number from head snapshot or version history. */
export function resolveLatestVersion(
  head: WidgetSnapshot | null,
  history: WidgetVersionEntry[]
): number {
  if (head?.version !== undefined) return head.version;
  if (history.length === 0) return 0;
  return history.reduce((max, entry) => Math.max(max, entry.version), 0);
}

/**
 * Resolve the artifact to preview for a selected version.
 * Never falls back to the latest head when viewing an older version.
 */
export function resolveDisplayArtifact(
  viewingVersion: number,
  latestVersion: number,
  head: WidgetSnapshot | null,
  history: WidgetVersionEntry[]
): WidgetSnapshot | null {
  const entry = history.find((v) => v.version === viewingVersion);

  if (entry?.luaSource) {
    return versionEntryToSnapshot(entry);
  }

  if (viewingVersion === latestVersion && head?.luaSource) {
    return head;
  }

  if (entry) {
    return versionEntryToSnapshot(entry);
  }

  return null;
}

/**
 * Commit an immutable version snapshot. Existing lua for a version is not overwritten
 * unless `force` is true (same version re-run after validation fix).
 */
export function commitVersionSnapshot(
  history: WidgetVersionEntry[],
  snapshot: WidgetSnapshot,
  options?: { messageId?: string | null; force?: boolean }
): WidgetVersionEntry[] {
  if (!snapshot.luaSource) return history;

  const idx = history.findIndex((v) => v.version === snapshot.version);
  const entry = snapshotToVersionEntry(snapshot, Date.now(), options?.messageId);

  if (idx >= 0) {
    const existing = history[idx]!;
    if (existing.luaSource && !options?.force) {
      const merged: WidgetVersionEntry = {
        ...existing,
        validated: entry.validated,
        validationIssues: entry.validationIssues,
        name: entry.name,
        instanceId: entry.instanceId ?? existing.instanceId,
      };
      const next = [...history];
      next[idx] = merged;
      return next;
    }
    const next = [...history];
    next[idx] = { ...entry, createdAt: existing.createdAt };
    return next;
  }

  return [...history, entry].sort((a, b) => a.version - b.version);
}

/** Ensure every version from 0..latest has a history row (metadata at minimum). */
export function buildVersionTimeline(
  history: WidgetVersionEntry[],
  latestVersion: number,
  head: WidgetSnapshot | null
): WidgetVersionEntry[] {
  const byVersion = new Map(history.map((e) => [e.version, e]));
  const timeline: WidgetVersionEntry[] = [];

  for (let v = 0; v <= latestVersion; v += 1) {
    const existing = byVersion.get(v);
    if (existing) {
      timeline.push(existing);
      continue;
    }
    if (v === latestVersion && head?.luaSource) {
      timeline.push(snapshotToVersionEntry(head));
      continue;
    }
    timeline.push({
      version: v,
      name: head?.name ?? "Widget",
      instanceId: head?.instanceId ?? null,
      luaSource: null,
      validated: false,
      validationIssues: [],
      createdAt: Date.now(),
    });
  }

  return timeline;
}
