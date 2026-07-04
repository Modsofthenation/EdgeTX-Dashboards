import { JsonlLocalAgentStore, getDefaultSdkStateRoot, type LocalAgentStore } from "@cursor/sdk";

/** Node 22.13+ ships built-in `node:sqlite`, which the SDK uses by default. */
export function hasBuiltinSqlite(): boolean {
  const [major, minor] = process.versions.node.split(".").map(Number);
  return major > 22 || (major === 22 && minor >= 13);
}

/**
 * Resolve local agent persistence for this repo.
 * Falls back to JSONL files when `node:sqlite` is unavailable (Node < 22.13).
 */
export function resolveLocalAgentStore(repoRoot: string): LocalAgentStore | undefined {
  if (hasBuiltinSqlite()) {
    return undefined;
  }
  return new JsonlLocalAgentStore(getDefaultSdkStateRoot(repoRoot));
}
