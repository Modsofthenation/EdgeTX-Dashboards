export interface RefineChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface RefineArtifactSnapshot {
  version: number;
  luaSource: string | null;
  validated: boolean;
}

export interface RefineHistoryInput {
  messages: RefineChatMessage[];
  currentPrompt: string;
  artifact: RefineArtifactSnapshot | null;
  artifactVersions: RefineArtifactSnapshot[];
  /** Live main.lua from workspace (preferred over DB snapshot when present). */
  workspaceLuaSource?: string | null;
}

export interface RefineHistorySections {
  conversationSummary: string;
  artifactContext: string;
}

const MAX_USER_TURN_CHARS = 600;
const MAX_ASSISTANT_TURN_CHARS = 400;
const MAX_PRIOR_LUA_LINES = 120;
const MAX_TOTAL_PRIOR_LUA_CHARS = 12_000;
/** Soft cap on conversation summary body (newest turns kept first). */
const MAX_CONVERSATION_CHARS = 12_000;

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function normalizePrompt(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function truncateLua(
  source: string,
  maxLines: number,
  maxChars: number,
): string {
  const lines = source.split(/\r?\n/);
  let body = source;
  if (lines.length > maxLines) {
    body = [
      ...lines.slice(0, maxLines),
      `-- … ${lines.length - maxLines} more lines omitted`,
    ].join("\n");
  }
  if (body.length > maxChars) {
    body = `${body.slice(0, maxChars - 40)}\n-- … source truncated for prompt budget`;
  }
  return body;
}

function resolveCurrentLua(
  input: RefineHistoryInput,
): { version: number; source: string } | null {
  const workspace = input.workspaceLuaSource?.trim();
  if (workspace) {
    const version =
      input.artifact?.version ?? input.artifactVersions.at(-1)?.version ?? 0;
    return { version, source: workspace };
  }

  if (input.artifact?.luaSource?.trim()) {
    return {
      version: input.artifact.version,
      source: input.artifact.luaSource.trim(),
    };
  }

  const latest = input.artifactVersions.at(-1);
  if (latest?.luaSource?.trim()) {
    return { version: latest.version, source: latest.luaSource.trim() };
  }

  return null;
}

function collectVersionSnapshots(
  input: RefineHistoryInput,
): RefineArtifactSnapshot[] {
  const byVersion = new Map<number, RefineArtifactSnapshot>();

  for (const entry of input.artifactVersions) {
    byVersion.set(entry.version, entry);
  }
  if (input.artifact) {
    byVersion.set(input.artifact.version, input.artifact);
  }

  const current = resolveCurrentLua(input);
  if (current) {
    const existing = byVersion.get(current.version);
    byVersion.set(current.version, {
      version: current.version,
      luaSource: current.source,
      validated: existing?.validated ?? input.artifact?.validated ?? false,
    });
  }

  return [...byVersion.values()].sort((a, b) => a.version - b.version);
}

/** Chronological summary of prior chat turns (excludes the current refinement prompt). */
export function buildConversationSummary(input: RefineHistoryInput): string {
  const currentNorm = normalizePrompt(input.currentPrompt);
  const turns: string[] = [];
  let turnIndex = 0;

  for (const message of input.messages) {
    const text = message.content.trim();
    if (!text) continue;

    if (message.role === "user" && normalizePrompt(text) === currentNorm) {
      continue;
    }

    turnIndex++;
    if (message.role === "user") {
      turns.push(
        `${turnIndex}. **User:** ${truncate(text, MAX_USER_TURN_CHARS)}`,
      );
    } else {
      turns.push(
        `${turnIndex}. **Assistant:** ${truncate(text, MAX_ASSISTANT_TURN_CHARS)}`,
      );
    }
  }

  if (turns.length === 0) {
    return "No prior chat turns in this session (first refinement or history unavailable).";
  }

  // Keep newest turns within the conversation budget.
  const kept: string[] = [];
  let budget = MAX_CONVERSATION_CHARS;
  for (let i = turns.length - 1; i >= 0; i--) {
    const turn = turns[i]!;
    if (kept.length > 0 && turn.length > budget) break;
    kept.unshift(turn);
    budget -= turn.length + 1;
    if (budget <= 0) break;
  }

  return [
    "Prior conversation in this chat (oldest → newest). Honor cumulative intent — do not undo earlier agreed features unless the latest request says so.",
    "",
    ...kept,
  ].join("\n");
}

/** Version timeline plus Lua sources for the current design and prior snapshots. */
export function buildArtifactContext(input: RefineHistoryInput): string {
  const versions = collectVersionSnapshots(input);
  const current = resolveCurrentLua(input);

  if (!current && versions.length === 0) {
    return "No prior widget Lua snapshot available — read `generated/<workspace>/main.lua` on disk before editing.";
  }

  const lines: string[] = [
    "Design artifacts for this dashboard. **Edit the current version** — use prior versions only as reference for what changed.",
    "",
  ];

  if (versions.length > 0) {
    lines.push("### Version timeline", "");
    for (const snap of versions) {
      const label =
        snap.version === 0
          ? "v0 — initial generation"
          : snap.version === current?.version
            ? `v${snap.version} — **current**`
            : `v${snap.version} — prior refine`;
      const status = snap.validated ? "validated" : "not validated";
      const hasLua = !!snap.luaSource?.trim();
      lines.push(
        `- ${label} (${status}${hasLua ? "" : ", no Lua snapshot stored"})`,
      );
    }
    lines.push("");
  }

  if (current) {
    lines.push(
      `### Current widget source (v${current.version}) — edit this`,
      "",
      "```lua",
      current.source,
      "```",
      "",
    );
  }

  const prior = versions.filter(
    (v) => v.version !== current?.version && v.luaSource?.trim(),
  );
  if (prior.length > 0) {
    lines.push("### Prior design snapshots (reference only)", "");
    let budget = MAX_TOTAL_PRIOR_LUA_CHARS;
    // Newest prior versions first so recent refine context wins the budget.
    for (const snap of prior.toReversed()) {
      const source = snap.luaSource!.trim();
      const capped = truncateLua(
        source,
        MAX_PRIOR_LUA_LINES,
        Math.min(budget, MAX_TOTAL_PRIOR_LUA_CHARS),
      );
      budget -= capped.length;
      lines.push(`#### v${snap.version}`, "", "```lua", capped, "```", "");
      if (budget <= 0) break;
    }
  }

  return lines.join("\n").trim();
}

export function buildRefineHistorySections(
  input: RefineHistoryInput,
): RefineHistorySections {
  return {
    conversationSummary: buildConversationSummary(input),
    artifactContext: buildArtifactContext(input),
  };
}
