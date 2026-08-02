import { CursorAgentError } from "@cursor/sdk";

function looksLikeSandboxFailure(message: string): boolean {
  return /wsl|sandbox|seatbelt|landlock|bubblewrap|sandboxing/i.test(message);
}

function looksLikeAuthFailure(message: string): boolean {
  return /api[_ ]?key|unauthorized|invalid.?key|\b401\b|\b403\b/i.test(message);
}

function looksLikeNetworkFailure(message: string): boolean {
  return /network|econnrefused|enotfound|fetch failed|timed out|etimedout|socket/i.test(
    message,
  );
}

/** Strip absolute filesystem paths before sending errors to the client. */
export function redactFilesystemPaths(text: string): string {
  return text
    .replace(/[A-Za-z]:\\(?:[^\s"'`]+)/g, "[path]")
    .replace(
      /\/(?:Users|home|tmp|var|opt|workspace|Users)(?:\/[^\s"'`]+)+/g,
      "[path]",
    )
    .replace(/(?:^|[\s("'=])(\/(?:[A-Za-z0-9._-]+\/)+[A-Za-z0-9._-]+)/g, (m) =>
      m.replace(/\/(?:[A-Za-z0-9._-]+\/)+[A-Za-z0-9._-]+/, "[path]"),
    );
}

/**
 * Turn Cursor/local-agent startup failures into actionable chat/SSE text.
 * Desktop Windows commonly fails when sandbox is on (WSL2 required).
 */
export function formatAgentStartupError(err: unknown): string {
  const raw = redactFilesystemPaths(
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "Unknown error",
  );

  // Already formatted by a previous pass.
  if (raw.startsWith("Startup failed:")) {
    return raw;
  }

  const prefix = err instanceof CursorAgentError ? "Startup failed: " : "";
  const hints: string[] = [];

  if (looksLikeSandboxFailure(raw)) {
    hints.push(
      "Cursor sandbox on Windows requires WSL2. Packaged desktop builds disable the sandbox by default — ensure CURSOR_SANDBOX_ENABLED is not forced on.",
    );
  }
  if (looksLikeAuthFailure(raw)) {
    hints.push("Check the Cursor API key in Settings → AI.");
  }
  if (looksLikeNetworkFailure(raw)) {
    hints.push(
      "Check that this app can reach Cursor over the network (firewall/proxy).",
    );
  }

  if (hints.length === 0) {
    return `${prefix}${raw}`;
  }
  return `${prefix}${raw} — ${hints.join(" ")}`;
}
