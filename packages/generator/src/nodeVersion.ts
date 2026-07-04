import { hasBuiltinSqlite } from "./localAgentStore.js";

const RECOMMENDED_NODE = [22, 13, 0];

export function assertNodeVersion(): void {
  if (hasBuiltinSqlite()) {
    return;
  }

  console.warn(
    `Node.js ${RECOMMENDED_NODE.join(".")}+ is recommended for @cursor/sdk (built-in node:sqlite). ` +
      `Current: ${process.versions.node}. Using JSONL agent store fallback.`
  );
}
